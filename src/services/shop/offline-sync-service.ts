import { db } from "@/lib/db";
import { fromMinorUnits } from "@/lib/utils";
import { reconcileStockAlert } from "@/lib/stock-alerts";
import { AppError } from "@/lib/errors/app-error";
import type { z } from "zod";
import type { offlineSyncPayloadSchema } from "@/validators/shop/offline-sync-validator";

type OfflineSyncPayload = z.infer<typeof offlineSyncPayloadSchema>;
type ShopSyncContext = {
  id: string;
  businessId: string;
  shopId: string;
  shop: { id: string; name: string; code: string; isActive: boolean };
};

type SyncResult = {
  queueId: string;
  localId: string;
  serverId: string;
  receiptNumber: string;
  status: "SYNCED" | "CONFLICT";
  conflicts: string[];
};

function createReceiptNumber(shopCode: string, date: Date, localId: string) {
  const day = date.toISOString().slice(0, 10).replaceAll("-", "");
  return `${shopCode}-${day}-${localId.replaceAll("-", "").slice(-8).toUpperCase()}`;
}

export async function synchronizeOfflineSales(user: ShopSyncContext, payload: OfflineSyncPayload) {
  const device = await db.offlineDevice.findFirst({
    where: { id: payload.deviceId, shopId: user.shopId, isActive: true, isTrusted: true },
  });
  if (!device) throw new AppError("This device is not authorized for offline synchronization.", "DEVICE_NOT_AUTHORIZED", 403);

  const admin = await db.user.findFirst({
    where: { businessId: user.businessId, role: "ADMIN", status: "ACTIVE" },
    select: { id: true, email: true },
  });
  if (!admin) throw new AppError("No active administrator account is configured.", "ADMIN_NOT_CONFIGURED", 409);

  const batch = await db.offlineSyncBatch.create({
    data: { shopId: user.shopId, deviceId: device.id, status: "PROCESSING", recordCount: payload.sales.length },
  });
  const results: SyncResult[] = [];
  let successCount = 0;
  let conflictCount = 0;
  let errorCount = 0;

  for (const entry of payload.sales) {
    try {
      if (entry.sale.shopId !== user.shopId || entry.sale.deviceId !== device.id) {
        throw new AppError("Shop or device mismatch.", "SHOP_DEVICE_MISMATCH", 403);
      }

      const existing = await db.idempotencyRecord.findUnique({ where: { key: entry.sale.idempotencyKey } });
      if (existing?.responseData) {
        results.push(existing.responseData as unknown as SyncResult);
        successCount += 1;
        continue;
      }

      const result = await db.$transaction(async (tx) => {
        const existingSale = await tx.sale.findUnique({ where: { clientReference: entry.sale.localId } });
        if (existingSale) {
          const response: SyncResult = {
            queueId: entry.queueId,
            localId: entry.sale.localId,
            serverId: existingSale.id,
            receiptNumber: existingSale.receiptNumber,
            status: "SYNCED",
            conflicts: [],
          };
          await tx.idempotencyRecord.upsert({
            where: { key: entry.sale.idempotencyKey },
            update: { responseData: response },
            create: { key: entry.sale.idempotencyKey, shopId: user.shopId, operation: "OFFLINE_SALE", responseData: response },
          });
          return response;
        }

        const productIds = entry.items.map((item) => item.productId);
        const products = await tx.product.findMany({ where: { id: { in: productIds }, businessId: user.businessId } });
        const productMap = new Map(products.map((product) => [product.id, product]));
        const inventories = await tx.shopInventory.findMany({ where: { shopId: user.shopId, productId: { in: productIds } } });
        const inventoryMap = new Map(inventories.map((inventory) => [inventory.productId, inventory]));
        if (inventories.length !== entry.items.length) {
          throw new AppError("One or more products are no longer assigned to this shop.", "SHOP_PRODUCT_MISSING", 409);
        }

        const occurredAt = new Date(entry.sale.occurredAt);
        const receipt = createReceiptNumber(user.shop.code, occurredAt, entry.sale.localId);
        const sale = await tx.sale.create({
          data: {
            shopId: user.shopId,
            registerSessionId: entry.sale.registerSessionId,
            salespersonId: entry.sale.salespersonId,
            receiptNumber: receipt,
            clientReference: entry.sale.localId,
            subtotal: fromMinorUnits(entry.sale.subtotalMinor),
            discountTotal: fromMinorUnits(entry.sale.discountMinor),
            taxTotal: fromMinorUnits(entry.sale.taxMinor),
            total: fromMinorUnits(entry.sale.totalMinor),
            amountPaid: fromMinorUnits(entry.sale.amountPaidMinor),
            changeDue: fromMinorUnits(entry.sale.changeDueMinor),
            customerName: entry.sale.customerName,
            isOffline: true,
            occurredAt,
            syncedAt: new Date(),
            items: {
              create: entry.items.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                sku: item.sku,
                unitId: item.unitId,
                unitName: item.unitName,
                unitSymbol: item.unitSymbol,
                quantity: item.quantity,
                unitCost: fromMinorUnits(item.unitCostMinor),
                unitPrice: fromMinorUnits(item.unitPriceMinor),
                lineTotal: fromMinorUnits(item.lineTotalMinor),
              })),
            },
            payments: {
              create: [{
                method: entry.sale.paymentMethod,
                status: entry.sale.paymentMethod === "CASH" ? "VERIFIED" : "PENDING",
                amount: fromMinorUnits(entry.sale.amountPaidMinor),
                reference: entry.sale.paymentReference,
              }],
            },
          },
        });

        const conflicts: string[] = [];
        for (const item of entry.items) {
          const inventory = inventoryMap.get(item.productId)!;
          const product = productMap.get(item.productId);
          if (!product || product.status !== "ACTIVE") conflicts.push(`PRODUCT_DEACTIVATED:${item.productId}`);
          const serverPriceMinor = Math.round(Number(inventory.sellingPrice) * 100);
          if (serverPriceMinor !== item.unitPriceMinor) conflicts.push(`PRICE_CHANGED:${item.productId}`);
          const newQuantity = Math.max(0, inventory.quantity - item.quantity);
          if (inventory.quantity < item.quantity) conflicts.push(`INSUFFICIENT_SERVER_STOCK:${item.productId}`);

          await tx.shopInventory.update({
            where: { id: inventory.id },
            data: { quantity: newQuantity, lastSoldAt: occurredAt, version: { increment: 1 } },
          });
          await tx.stockMovement.create({
            data: {
              shopId: user.shopId,
              productId: item.productId,
              type: inventory.quantity < item.quantity ? "OFFLINE_RECONCILIATION" : "SALE",
              quantityChange: -item.quantity,
              quantityBefore: inventory.quantity,
              quantityAfter: newQuantity,
              referenceType: "SALE",
              referenceId: sale.id,
              note: inventory.quantity < item.quantity
                ? "Offline sale exceeded current server stock; administrator reconciliation required."
                : undefined,
            },
          });
          await reconcileStockAlert(tx, {
            businessId: user.businessId,
            shopId: user.shopId,
            shopName: user.shop.name,
            productId: item.productId,
            productName: item.productName,
            quantity: newQuantity,
            reorderLevel: inventory.reorderLevel,
            criticalLevel: inventory.criticalLevel,
            adminId: admin.id,
            adminEmail: admin.email,
          });
        }

        for (const conflict of conflicts) {
          const [type, productId] = conflict.split(":");
          await tx.offlineSyncConflict.create({
            data: {
              shopId: user.shopId,
              deviceId: device.id,
              batchId: batch.id,
              type: type as "INSUFFICIENT_SERVER_STOCK" | "PRODUCT_DEACTIVATED" | "PRICE_CHANGED",
              entityType: "SALE",
              entityReference: entry.sale.localId,
              details: { productId, saleId: sale.id, receiptNumber: receipt },
            },
          });
        }

        if (conflicts.length) {
          await tx.notification.create({
            data: {
              userId: admin.id,
              shopId: user.shopId,
              type: "SYNC_CONFLICT",
              priority: "HIGH",
              title: `Offline reconciliation needed at ${user.shop.name}`,
              message: `${receipt} synchronized with ${conflicts.length} inventory conflict${conflicts.length === 1 ? "" : "s"}.`,
              actionUrl: "/admin/synchronization",
            },
          });
        }

        const response: SyncResult = {
          queueId: entry.queueId,
          localId: entry.sale.localId,
          serverId: sale.id,
          receiptNumber: receipt,
          status: conflicts.length ? "CONFLICT" : "SYNCED",
          conflicts,
        };
        await tx.idempotencyRecord.create({
          data: { key: entry.sale.idempotencyKey, shopId: user.shopId, operation: "OFFLINE_SALE", responseData: response },
        });
        return response;
      }, { maxWait: 10_000, timeout: 30_000 });

      results.push(result);
      if (result.status === "CONFLICT") conflictCount += 1;
      else successCount += 1;
    } catch (error) {
      errorCount += 1;
      results.push({
        queueId: entry.queueId,
        localId: entry.sale.localId,
        serverId: "",
        receiptNumber: "",
        status: "CONFLICT",
        conflicts: [error instanceof Error ? error.message : "Synchronization failed"],
      });
    }
  }

  await db.offlineSyncBatch.update({
    where: { id: batch.id },
    data: {
      status: errorCount ? (successCount || conflictCount ? "PARTIAL" : "FAILED") : "COMPLETED",
      successCount,
      conflictCount,
      errorCount,
      completedAt: new Date(),
    },
  });
  await db.offlineDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date(), lastSyncAt: new Date() } });
  return { batchId: batch.id, results };
}
