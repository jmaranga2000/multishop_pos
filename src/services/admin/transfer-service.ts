import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors/app-error";
import { createDocumentNumber } from "@/lib/ids/document-number";
import { reconcileStockAlert } from "@/lib/stock-alerts";
import { writeAuditLog } from "@/services/shared/audit-service";
import type { z } from "zod";
import type { createTransferSchema } from "@/validators/admin/transfer-validator";

type CreateTransferInput = z.infer<typeof createTransferSchema>;
type AdminContext = { id: string; email: string; businessId: string };

export async function getTransferManagementData(businessId: string) {
  const [shops, products, transfers] = await Promise.all([
    prisma.shop.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { businessId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.stockTransfer.findMany({
      where: { sourceShop: { businessId } },
      include: { sourceShop: true, destinationShop: true, items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return { shops, products, transfers };
}

export async function createStockTransfer(admin: AdminContext, input: CreateTransferInput) {
  const [source, destination, product, inventory] = await Promise.all([
    prisma.shop.findFirst({ where: { id: input.sourceShopId, businessId: admin.businessId, isActive: true } }),
    prisma.shop.findFirst({ where: { id: input.destinationShopId, businessId: admin.businessId, isActive: true } }),
    prisma.product.findFirst({ where: { id: input.productId, businessId: admin.businessId, status: "ACTIVE" } }),
    prisma.shopInventory.findUnique({ where: { shopId_productId: { shopId: input.sourceShopId, productId: input.productId } } }),
  ]);
  if (!source || !destination || !product) throw new AppError("The selected shop or product was not found.");
  if (!inventory || inventory.quantity < input.quantity) throw new AppError("The source shop does not have enough stock.");

  const transfer = await prisma.stockTransfer.create({
    data: {
      transferNumber: createDocumentNumber("TRF", source.code),
      sourceShopId: source.id,
      destinationShopId: destination.id,
      note: input.note || null,
      items: { create: { productId: product.id, requestedQuantity: input.quantity } },
    },
  });
  await writeAuditLog(prisma, {
    userId: admin.id,
    shopId: source.id,
    action: "STOCK_TRANSFER_CREATED",
    entityType: "STOCK_TRANSFER",
    entityId: transfer.id,
    description: `Created transfer ${transfer.transferNumber} from ${source.name} to ${destination.name}.`,
  });
  return transfer;
}

export async function dispatchStockTransfer(admin: AdminContext, transferId: string) {
  const transfer = await prisma.stockTransfer.findFirst({
    where: { id: transferId, sourceShop: { businessId: admin.businessId } },
    include: { sourceShop: true, destinationShop: true, items: { include: { product: true } } },
  });
  if (!transfer) throw new AppError("Transfer was not found.", "TRANSFER_NOT_FOUND", 404);
  if (transfer.status !== "DRAFT") throw new AppError("Only draft transfers can be dispatched.");

  return prisma.$transaction(async (tx) => {
    for (const item of transfer.items) {
      const inventory = await tx.shopInventory.findUnique({
        where: { shopId_productId: { shopId: transfer.sourceShopId, productId: item.productId } },
      });
      if (!inventory || inventory.quantity < item.requestedQuantity) {
        throw new AppError(`${item.product.name} no longer has enough stock at ${transfer.sourceShop.name}.`);
      }
      const updated = await tx.shopInventory.update({
        where: { id: inventory.id },
        data: { quantity: { decrement: item.requestedQuantity }, version: { increment: 1 } },
      });
      await tx.stockMovement.create({
        data: {
          shopId: transfer.sourceShopId,
          productId: item.productId,
          type: "TRANSFER_OUT",
          quantityChange: -item.requestedQuantity,
          quantityBefore: inventory.quantity,
          quantityAfter: updated.quantity,
          referenceType: "STOCK_TRANSFER",
          referenceId: transfer.id,
          note: `Dispatched to ${transfer.destinationShop.name}`,
        },
      });
      await tx.stockTransferItem.update({ where: { id: item.id }, data: { dispatchedQuantity: item.requestedQuantity } });
      await reconcileStockAlert(tx, {
        businessId: admin.businessId,
        shopId: transfer.sourceShopId,
        shopName: transfer.sourceShop.name,
        productId: item.productId,
        productName: item.product.name,
        quantity: updated.quantity,
        reorderLevel: updated.reorderLevel,
        criticalLevel: updated.criticalLevel,
        adminId: admin.id,
        adminEmail: admin.email,
      });
    }
    const updatedTransfer = await tx.stockTransfer.update({ where: { id: transfer.id }, data: { status: "DISPATCHED", dispatchedAt: new Date() } });
    const destinationAccount = await tx.user.findUnique({ where: { shopId: transfer.destinationShopId } });
    if (destinationAccount) {
      await tx.notification.create({
        data: {
          userId: destinationAccount.id,
          shopId: transfer.destinationShopId,
          type: "STOCK_TRANSFER",
          priority: "HIGH",
          title: "Incoming stock transfer",
          message: `${transfer.transferNumber} has been dispatched from ${transfer.sourceShop.name}.`,
          actionUrl: "/shop/transfers",
        },
      });
    }
    await writeAuditLog(tx, {
      userId: admin.id,
      shopId: transfer.sourceShopId,
      action: "STOCK_TRANSFER_DISPATCHED",
      entityType: "STOCK_TRANSFER",
      entityId: transfer.id,
      description: `Dispatched ${transfer.transferNumber} to ${transfer.destinationShop.name}.`,
    });
    return updatedTransfer;
  });
}
