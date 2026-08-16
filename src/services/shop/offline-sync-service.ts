import { db } from "@/lib/db";
import { hasPriceMismatchBetweenMinorUnits } from "@/lib/offline/price";
import { detectMixedUnitSaleConflict } from "@/lib/offline/conflicts";
import { fromMinorUnits } from "@/lib/utils";
import { reconcileStockAlert } from "@/lib/stock-alerts";
import { writeAuditLog } from "@/services/shared/audit-service";
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
        const existingResponse = existing.responseData as unknown as SyncResult;
        const openConflict = await db.offlineSyncConflict.findFirst({
          where: { entityReference: entry.sale.localId, status: "OPEN" },
          select: { id: true },
        });
        if (existingResponse.status === "CONFLICT" && !openConflict) {
          const resolvedResponse: SyncResult = {
            ...existingResponse,
            status: "SYNCED",
            conflicts: [],
          };
          await db.idempotencyRecord.update({
            where: { key: entry.sale.idempotencyKey },
            data: { responseData: resolvedResponse },
          });
          results.push(resolvedResponse);
          successCount += 1;
          continue;
        }
        results.push(existingResponse);
        if (existingResponse.status === "CONFLICT") conflictCount += 1;
        else successCount += 1;
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

        if (detectMixedUnitSaleConflict(entry.items)) {
          const conflictType = "MIXED_UNIT_SALE" as const;
          await tx.offlineSyncConflict.create({
            data: {
              shopId: user.shopId,
              deviceId: device.id,
              batchId: batch.id,
              type: conflictType,
              entityType: "SALE",
              entityReference: entry.sale.localId,
              details: {
                reason: "A single product was sold in multiple unit options in one sale.",
                productIds: Array.from(new Set(entry.items.map((item) => item.productId))),
                units: Array.from(new Set(entry.items.map((item) => item.unitId ?? "default"))),
              },
            },
          });
          await tx.notification.create({
            data: {
              userId: admin.id,
              shopId: user.shopId,
              type: "SYNC_CONFLICT",
              priority: "HIGH",
              title: `Mixed unit sale at ${user.shop.name}`,
              message: `${entry.sale.localId} contains more than one unit option for the same product and requires review.`,
              actionUrl: "/admin/synchronization",
            },
          });
          throw new AppError("A single product cannot be sold in multiple unit options in the same sale.", "MIXED_UNIT_SALE", 409);
        }

        const productIds = entry.items.map((item) => item.productId);
        const products = await tx.product.findMany({ where: { id: { in: productIds }, businessId: user.businessId }, include: { pricingUnits: true } });
        const productMap = new Map(products.map((product) => [product.id, product]));
        const inventories = await tx.shopInventory.findMany({ where: { shopId: user.shopId, productId: { in: productIds } } });
        const inventoryMap = new Map(inventories.map((inventory) => [inventory.productId, inventory]));
        if (inventories.length !== entry.items.length) {
          throw new AppError("One or more products are no longer assigned to this shop.", "SHOP_PRODUCT_MISSING", 409);
        }

        const occurredAt = new Date(entry.sale.occurredAt);
        const receipt = createReceiptNumber(user.shop.code, occurredAt, entry.sale.localId);
        
        const salePayments = entry.sale.payments && entry.sale.payments.length > 0
          ? entry.sale.payments
          : [{
              method: entry.sale.paymentMethod,
              amountMinor: entry.sale.amountPaidMinor,
              reference: entry.sale.paymentReference ?? null,
            }];
        const confirmedMpesaPayments = new Map<string, any>();
        for (const payment of salePayments.filter((entry) => entry.method === "MPESA")) {
          if (!payment.reference) {
            throw new AppError("A confirmed M-Pesa payment reference is required before the sale can be synchronized.", "MPESA_REFERENCE_REQUIRED", 409);
          }
          const mpesa = await tx.mpesaPayment.findFirst({
            where: {
              shopId: user.shopId,
              status: { in: ["SUCCESSFUL", "MATCHED"] },
              OR: [
                { id: payment.reference },
                { internalReference: payment.reference },
                { transactionId: payment.reference },
                { receiptNumber: payment.reference },
              ],
            },
          });
          if (!mpesa || Number(mpesa.receivedAmountMinor) < payment.amountMinor || mpesa.saleId !== entry.sale.localId) {
            throw new AppError("The M-Pesa payment is not confirmed for this sale and amount.", "MPESA_NOT_CONFIRMED", 409);
          }
          confirmedMpesaPayments.set(payment.reference, mpesa);
        }

        // Verified M-Pesa references are checked above; credit is recorded in the customer ledger instead.
        const paymentsData = salePayments
          .filter((payment) => payment.method !== "CREDIT")
          .map((payment) => ({
            method: payment.method as "CASH" | "MPESA" | "CARD" | "BANK_TRANSFER",
            status: (payment.method === "CASH" || payment.method === "MPESA" ? "VERIFIED" : "PENDING") as "VERIFIED" | "PENDING",
            amount: fromMinorUnits(payment.amountMinor),
            reference: (payment.reference ?? null) as string | null,
          }));
        const sale = await tx.sale.create({
          data: {
            shopId: user.shopId,
            registerSessionId: entry.sale.registerSessionId,
            salespersonId: entry.sale.salespersonId,
            receiptNumber: receipt,
            clientReference: entry.sale.localId,
            status: "COMPLETED",
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
              create: paymentsData,
            },
          },
        });

        for (const mpesa of confirmedMpesaPayments.values()) {
          await tx.mpesaPayment.update({
            where: { id: mpesa.id },
            data: { saleId: sale.id, updatedAt: new Date() },
          });
        }
        // Handle credit portions: create ledger entries and update customer outstanding balances
        const creditPayments = (entry.sale.payments ?? []).filter((p) => p.method === "CREDIT");
          if (creditPayments.length > 0) {
          if (!entry.sale.customerId) {
            // mark as conflict
            await tx.offlineSyncConflict.create({ data: { shopId: user.shopId, deviceId: device.id, batchId: batch.id, type: "CREDIT_LIMIT_EXCEEDED", entityType: "SALE", entityReference: entry.sale.localId, details: { reason: "Missing customer for credit sale" } } });
            await writeAuditLog(tx, { action: "CREDIT_SALE_REJECTED", userId: user.id, shopId: user.shopId, description: `Credit sale missing customer: ${entry.sale.localId}`, metadata: { localId: entry.sale.localId } });
            throw new AppError("Credit sales must include a customerId.", "MISSING_CUSTOMER", 400);
          }
          const customer = await tx.customer.findFirst({ where: { id: entry.sale.customerId, shopId: user.shopId } });
          if (!customer) {
            await tx.offlineSyncConflict.create({ data: { shopId: user.shopId, deviceId: device.id, batchId: batch.id, type: "CREDIT_LIMIT_EXCEEDED", entityType: "SALE", entityReference: entry.sale.localId, details: { reason: "Customer not found for credit sale" } } });
            await writeAuditLog(tx, { action: "CREDIT_SALE_REJECTED", userId: user.id, shopId: user.shopId, description: `Customer not found for credit sale: ${entry.sale.localId}`, metadata: { localId: entry.sale.localId, customerId: entry.sale.customerId } });
            throw new AppError("Customer not found for credit sale.", "CUSTOMER_NOT_FOUND", 404);
          }

          const totalCreditMinor = creditPayments.reduce((s, p) => s + p.amountMinor, 0);
          const previous = Number(customer.cachedOutstandingMinor ?? 0);
          const newBalance = previous + totalCreditMinor;

          // Enforce account status: do not accept credit sales for suspended or restricted accounts
          if (customer.status && (customer.status === "SUSPENDED" || customer.status === "CREDIT_RESTRICTED")) {
            await tx.offlineSyncConflict.create({ data: { shopId: user.shopId, deviceId: device.id, batchId: batch.id, type: "CREDIT_ACCOUNT_RESTRICTED", entityType: "SALE", entityReference: entry.sale.localId, details: { reason: `Customer account status ${customer.status}` } } });
            await writeAuditLog(tx, { action: "CREDIT_SALE_REJECTED", userId: user.id, shopId: user.shopId, description: `Credit sale rejected due to customer status: ${entry.sale.localId}`, metadata: { localId: entry.sale.localId, customerId: entry.sale.customerId, status: customer.status } });
            throw new AppError("Customer account is not allowed to take credit sales.", "CUSTOMER_ACCOUNT_RESTRICTED", 403);
          }

          if (customer.creditLimit !== undefined && customer.creditLimit !== null && newBalance > Number(customer.creditLimit)) {
            // Create a sync conflict and notify admin
            await tx.offlineSyncConflict.create({ data: { shopId: user.shopId, deviceId: device.id, batchId: batch.id, type: "CREDIT_LIMIT_EXCEEDED", entityType: "SALE", entityReference: entry.sale.localId, details: { requiredLimitMinor: customer.creditLimit, attemptedMinor: totalCreditMinor, previousBalanceMinor: previous } } });
            await tx.notification.create({ data: { userId: admin.id, shopId: user.shopId, type: "SYNC_CONFLICT", priority: "HIGH", title: `Credit limit exceeded at ${user.shop.name}`, message: `Sale ${receipt} attempted credit ${fromMinorUnits(totalCreditMinor)} exceeding limit ${fromMinorUnits(Number(customer.creditLimit))}`, actionUrl: "/admin/credit" } });
            await writeAuditLog(tx, { action: "CREDIT_LIMIT_EXCEEDED", userId: user.id, shopId: user.shopId, description: `Credit limit exceeded for sale ${entry.sale.localId}`, metadata: { localId: entry.sale.localId, customerId: customer.id, attemptedMinor: totalCreditMinor, limitMinor: customer.creditLimit } });
            // mark conflicts to be handled; don't create ledger entries — abort processing this entry so outer logic records conflict
            throw new AppError("Credit limit exceeded for customer", "CREDIT_LIMIT_EXCEEDED", 409);
          }

          // Idempotency check: ensure ledger entry is created only once per transaction
          const transactionId = `credit-sale-${entry.sale.localId}`;
          const existingEntry = await tx.ledgerEntry.findFirst({ where: { transactionId, customerId: entry.sale.customerId, shopId: user.shopId } });
          
          if (!existingEntry) {
            await tx.ledgerEntry.create({ data: {
              transactionId,
              customerId: entry.sale.customerId,
              shopId: user.shopId,
              type: "CREDIT_SALE",
              occurredAt,
              reference: sale.id,
              description: `Credit sale ${sale.receiptNumber}`,
              debitMinor: totalCreditMinor,
              creditMinor: 0,
              runningBalanceMinor: newBalance,
              userId: entry.sale.salespersonId ?? null,
              saleId: sale.id,
              paymentId: null,
              syncStatus: "SYNCED",
              createdAt: new Date(),
            } });

            await tx.customer.update({ where: { id: customer.id }, data: { cachedOutstandingMinor: newBalance, lastTransactionAt: new Date() } });
          }
        }

        const conflicts: string[] = [];
        for (const item of entry.items) {
          const inventory = inventoryMap.get(item.productId)!;
          const product = productMap.get(item.productId);
          if (!product || product.status !== "ACTIVE") conflicts.push(`PRODUCT_DEACTIVATED:${item.productId}`);
          // Compare the cart to the price for the unit the cashier selected, not the shop's default price.
          const pricingUnit = (product?.pricingUnits ?? []).find((pricing: { unitId: string; sellingPrice: number; multiplier?: number }) => pricing.unitId === item.unitId);
          const isDefaultUnit = !item.unitId || item.unitId === product?.unitId;
          const currentUnitPrice = pricingUnit?.sellingPrice
            ?? (isDefaultUnit ? product?.defaultSellingPrice : undefined);
          const serverPriceMinor = currentUnitPrice === undefined
            ? undefined
            : Math.round(Number(currentUnitPrice) * 100);
          if (
            serverPriceMinor === undefined
            || hasPriceMismatchBetweenMinorUnits(serverPriceMinor, item.unitPriceMinor)
          ) {
            conflicts.push(`PRICE_CHANGED:${item.productId}`);
          }
          // Convert sold quantity in the item's unit to base inventory units using pricing unit multiplier
          const multiplier = pricingUnit?.multiplier ?? (product?.unitId === item.unitId ? 1 : 1);
          const effectiveQuantity = item.quantity * multiplier;
          const newQuantity = Math.max(0, inventory.quantity - effectiveQuantity);
          if (inventory.quantity < effectiveQuantity) conflicts.push(`INSUFFICIENT_SERVER_STOCK:${item.productId}`);

          await tx.shopInventory.update({
            where: { id: inventory.id },
            data: { quantity: newQuantity, lastSoldAt: occurredAt, version: { increment: 1 } },
          });
          await tx.stockMovement.create({
            data: {
              shopId: user.shopId,
              productId: item.productId,
              type: inventory.quantity < effectiveQuantity ? "OFFLINE_RECONCILIATION" : "SALE",
              quantityChange: -effectiveQuantity,
              quantityBefore: inventory.quantity,
              quantityAfter: newQuantity,
              referenceType: "SALE",
              referenceId: sale.id,
              note: inventory.quantity < effectiveQuantity
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
