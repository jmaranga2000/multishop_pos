import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { reconcileStockAlert } from "@/lib/stock-alerts";
import { writeAuditLog } from "@/services/shared/audit-service";

type ShopContext = { id: string; shopId: string; businessId: string };

export async function listIncomingTransfers(shopId: string) {
  return db.stockTransfer.findMany({
    where: { destinationShopId: shopId },
    include: { sourceShop: true, destinationShop: true, items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function receiveIncomingTransfer(shopUser: ShopContext, transferId: string) {
  const transfer = await db.stockTransfer.findFirst({
    where: { id: transferId, destinationShopId: shopUser.shopId },
    include: { sourceShop: true, destinationShop: true, items: { include: { product: true } } },
  });
  if (!transfer) throw new AppError("Incoming transfer was not found.", "TRANSFER_NOT_FOUND", 404);
  if (transfer.status !== "DISPATCHED" && transfer.status !== "PARTIALLY_RECEIVED") {
    throw new AppError("This transfer is not awaiting receipt.");
  }
  const admin = await db.user.findFirst({ where: { businessId: shopUser.businessId, role: "ADMIN", status: "ACTIVE" } });
  if (!admin) throw new AppError("Administrator account was not found.");

  return db.$transaction(async (tx) => {
    for (const item of transfer.items) {
      const quantity = item.dispatchedQuantity - item.receivedQuantity;
      if (quantity <= 0) continue;
      const existing = await tx.shopInventory.findUnique({
        where: { shopId_productId: { shopId: shopUser.shopId, productId: item.productId } },
      });
      const before = existing?.quantity ?? 0;
      const inventory = await tx.shopInventory.upsert({
        where: { shopId_productId: { shopId: shopUser.shopId, productId: item.productId } },
        update: { quantity: { increment: quantity }, isAvailable: true, lastStockedAt: new Date(), version: { increment: 1 } },
        create: {
          shopId: shopUser.shopId,
          productId: item.productId,
          quantity,
          costPrice: item.product.defaultCostPrice,
          sellingPrice: item.product.defaultSellingPrice,
          lastStockedAt: new Date(),
        },
      });
      await tx.stockMovement.create({
        data: {
          shopId: shopUser.shopId,
          productId: item.productId,
          type: "TRANSFER_IN",
          quantityChange: quantity,
          quantityBefore: before,
          quantityAfter: inventory.quantity,
          referenceType: "STOCK_TRANSFER",
          referenceId: transfer.id,
          note: `Received from ${transfer.sourceShop.name}`,
        },
      });
      await tx.stockTransferItem.update({ where: { id: item.id }, data: { receivedQuantity: { increment: quantity } } });
      await reconcileStockAlert(tx, {
        businessId: shopUser.businessId,
        shopId: shopUser.shopId,
        shopName: transfer.destinationShop.name,
        productId: item.productId,
        productName: item.product.name,
        quantity: inventory.quantity,
        reorderLevel: inventory.reorderLevel,
        criticalLevel: inventory.criticalLevel,
        adminId: admin.id,
        adminEmail: admin.email,
      });
    }
    const updated = await tx.stockTransfer.update({ where: { id: transfer.id }, data: { status: "RECEIVED", receivedAt: new Date() } });
    await writeAuditLog(tx, {
      userId: shopUser.id,
      shopId: shopUser.shopId,
      action: "STOCK_TRANSFER_RECEIVED",
      entityType: "STOCK_TRANSFER",
      entityId: transfer.id,
      description: `Received ${transfer.transferNumber} from ${transfer.sourceShop.name}.`,
    });
    return updated;
  });
}
