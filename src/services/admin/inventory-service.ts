import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { reconcileStockAlert } from "@/lib/stock-alerts";
import { writeAuditLog } from "@/services/shared/audit-service";
import type { z } from "zod";
import type { addStockSchema, adjustStockSchema } from "@/validators/admin/inventory-validator";

type AddStockInput = z.infer<typeof addStockSchema>;
type AdjustStockInput = z.infer<typeof adjustStockSchema>;

type AdminContext = { id: string; email: string; businessId: string };

export async function getInventoryManagementData(businessId: string) {
  const [business, shops, products, inventory] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.shop.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } }),
    db.product.findMany({ where: { businessId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    db.shopInventory.findMany({
      where: { shop: { businessId } },
      include: { shop: true, product: true },
      orderBy: [{ shop: { name: "asc" } }, { product: { name: "asc" } }],
    }),
  ]);
  return { business, shops, products, inventory };
}

export async function addStock(admin: AdminContext, input: AddStockInput) {
  const [shop, product] = await Promise.all([
    db.shop.findFirst({ where: { id: input.shopId, businessId: admin.businessId } }),
    db.product.findFirst({ where: { id: input.productId, businessId: admin.businessId } }),
  ]);
  if (!shop || !product) throw new AppError("The selected shop or product was not found.");

  return db.$transaction(async (tx) => {
    const existing = await tx.shopInventory.findUnique({ where: { shopId_productId: { shopId: shop.id, productId: product.id } } });
    const before = existing?.quantity ?? 0;
    const inventory = await tx.shopInventory.upsert({
      where: { shopId_productId: { shopId: shop.id, productId: product.id } },
      update: {
        quantity: { increment: input.quantity },
        costPrice: input.costPrice,
        sellingPrice: input.sellingPrice,
        reorderLevel: input.reorderLevel,
        criticalLevel: input.criticalLevel,
        lastStockedAt: new Date(),
        isAvailable: true,
        version: { increment: 1 },
      },
      create: {
        shopId: shop.id,
        productId: product.id,
        quantity: input.quantity,
        costPrice: input.costPrice,
        sellingPrice: input.sellingPrice,
        reorderLevel: input.reorderLevel,
        criticalLevel: input.criticalLevel,
        lastStockedAt: new Date(),
      },
    });
    await tx.stockMovement.create({
      data: {
        shopId: shop.id,
        productId: product.id,
        type: existing ? "PURCHASE_RECEIPT" : "OPENING_STOCK",
        quantityChange: input.quantity,
        quantityBefore: before,
        quantityAfter: inventory.quantity,
        referenceType: "ADMIN_STOCK",
        note: "Stock added by administrator",
      },
    });
    await reconcileStockAlert(tx, {
      businessId: admin.businessId,
      shopId: shop.id,
      shopName: shop.name,
      productId: product.id,
      productName: product.name,
      quantity: inventory.quantity,
      reorderLevel: inventory.reorderLevel,
      criticalLevel: inventory.criticalLevel,
      adminId: admin.id,
      adminEmail: admin.email,
    });
    await writeAuditLog(tx, {
      userId: admin.id,
      shopId: shop.id,
      action: "STOCK_ADDED",
      entityType: "PRODUCT",
      entityId: product.id,
      description: `Added ${input.quantity} units of ${product.name} to ${shop.name}.`,
      metadata: { quantity: input.quantity, before, after: inventory.quantity },
    });
    return inventory;
  });
}

export async function adjustStock(admin: AdminContext, input: AdjustStockInput) {
  const inventory = await db.shopInventory.findFirst({
    where: { id: input.inventoryId, shop: { businessId: admin.businessId } },
    include: { shop: true, product: true },
  });
  if (!inventory) throw new AppError("Inventory record was not found.", "INVENTORY_NOT_FOUND", 404);
  if (input.quantity < 0) throw new AppError("Stock quantity cannot be negative.");

  return db.$transaction(async (tx) => {
    const updated = await tx.shopInventory.update({
      where: { id: inventory.id },
      data: { quantity: input.quantity, isAvailable: input.quantity > 0, version: { increment: 1 } },
    });
    await tx.stockMovement.create({
      data: {
        shopId: inventory.shopId,
        productId: inventory.productId,
        type: "MANUAL_ADJUSTMENT",
        quantityChange: input.quantity - inventory.quantity,
        quantityBefore: inventory.quantity,
        quantityAfter: input.quantity,
        referenceType: "MANUAL_ADJUSTMENT",
        note: input.reason,
      },
    });
    await reconcileStockAlert(tx, {
      businessId: admin.businessId,
      shopId: inventory.shopId,
      shopName: inventory.shop.name,
      productId: inventory.productId,
      productName: inventory.product.name,
      quantity: updated.quantity,
      reorderLevel: updated.reorderLevel,
      criticalLevel: updated.criticalLevel,
      adminId: admin.id,
      adminEmail: admin.email,
    });
    await writeAuditLog(tx, {
      userId: admin.id,
      shopId: inventory.shopId,
      action: "STOCK_ADJUSTED",
      entityType: "SHOP_INVENTORY",
      entityId: inventory.id,
      description: `Adjusted ${inventory.product.name} at ${inventory.shop.name} from ${inventory.quantity} to ${input.quantity}.`,
      metadata: { reason: input.reason },
    });
    return updated;
  });
}

export async function updateInventory(admin: AdminContext, input: z.infer<typeof import("@/validators/admin/inventory-validator").updateInventorySchema>) {
  const inventory = await db.shopInventory.findFirst({ where: { id: input.inventoryId, shop: { businessId: admin.businessId } } });
  if (!inventory) throw new AppError("Inventory record was not found.", "INVENTORY_NOT_FOUND", 404);

  const [shop, product] = await Promise.all([
    db.shop.findFirst({ where: { id: input.shopId, businessId: admin.businessId } }),
    db.product.findFirst({ where: { id: input.productId, businessId: admin.businessId } }),
  ]);
  if (!shop || !product) throw new AppError("Selected shop or product not found.");

  // Prevent duplicate shop+product pair when changing shop/product
  const existing = await db.shopInventory.findFirst({ where: { shopId: input.shopId, productId: input.productId } });
  if (existing && existing.id !== inventory.id) throw new AppError("An inventory record for that shop and product already exists.");

  return db.$transaction(async (tx) => {
    const updated = await tx.shopInventory.update({
      where: { id: inventory.id },
      data: {
        shopId: shop.id,
        productId: product.id,
        costPrice: input.costPrice,
        sellingPrice: input.sellingPrice,
        reorderLevel: input.reorderLevel,
        criticalLevel: input.criticalLevel,
        isAvailable: !!input.isAvailable,
        version: { increment: 1 },
      },
    });

    await reconcileStockAlert(tx, {
      businessId: admin.businessId,
      shopId: updated.shopId,
      shopName: shop.name,
      productId: updated.productId,
      productName: product.name,
      quantity: updated.quantity,
      reorderLevel: updated.reorderLevel,
      criticalLevel: updated.criticalLevel,
      adminId: admin.id,
      adminEmail: admin.email,
    });

    await writeAuditLog(tx, {
      userId: admin.id,
      shopId: updated.shopId,
      action: "INVENTORY_UPDATED",
      entityType: "SHOP_INVENTORY",
      entityId: updated.id,
      description: `Updated inventory ${updated.id} (${product.name} @ ${shop.name}).`,
      metadata: { before: inventory, after: updated },
    });

    return updated;
  });
}
