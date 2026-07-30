import { db } from "@/lib/db";
import { writeAuditLog } from "@/services/shared/audit-service";
import type { z } from "zod";
import type { createProductSchema, updateProductSchema } from "@/validators/admin/product-validator";

type CreateProductInput = z.infer<typeof createProductSchema>;
type UpdateProductInput = z.infer<typeof updateProductSchema>;

export async function listAdminProducts(businessId: string) {
  const [business, products] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.product.findMany({
      where: { businessId },
      include: { category: true, brand: true, unit: true, _count: { select: { inventory: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return { business, products };
}

export async function getProductManagementData(businessId: string) {
  const [business, products, categories, brands, units] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.product.findMany({
      where: { businessId },
      include: { category: true, brand: true, unit: true, _count: { select: { inventory: true } } },
      orderBy: { name: "asc" },
    }),
    db.category.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } }),
    db.brand.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } }),
    db.unit.findMany({ where: { businessId }, orderBy: { name: "asc" } }),
  ]);
  return { business, products, categories, brands, units };
}

export async function getAdminProductById(businessId: string, productId: string) {
  return db.product.findFirst({
    where: { id: productId, businessId },
    include: { category: true, brand: true, unit: true, _count: { select: { inventory: true } } },
  });
}

export async function createProduct(admin: { id: string; businessId: string }, input: CreateProductInput) {
  const product = await db.product.create({
    data: {
      businessId: admin.businessId,
      name: input.name,
      sku: input.sku,
      barcode: input.barcode || null,
      categoryId: input.categoryId || null,
      brandId: input.brandId || null,
      unitId: input.unitId || null,
      defaultCostPrice: input.defaultCostPrice,
      defaultSellingPrice: input.defaultSellingPrice,
    },
  });
  await writeAuditLog(db, {
    userId: admin.id,
    action: "PRODUCT_CREATED",
    entityType: "PRODUCT",
    entityId: product.id,
    description: `Created product ${product.name}.`,
  });
  return product;
}

export async function updateProduct(admin: { id: string; businessId: string }, input: UpdateProductInput) {
  const product = await db.product.findFirst({ where: { id: input.productId, businessId: admin.businessId } });
  if (!product) throw new Error("Product not found.");

  const updatedProduct = await db.product.update({
    where: { id: input.productId },
    data: {
      name: input.name,
      sku: input.sku,
      barcode: input.barcode || null,
      categoryId: input.categoryId || null,
      brandId: input.brandId || null,
      unitId: input.unitId || null,
      defaultCostPrice: input.defaultCostPrice,
      defaultSellingPrice: input.defaultSellingPrice,
    },
  });

  await writeAuditLog(db, {
    userId: admin.id,
    action: "PRODUCT_UPDATED",
    entityType: "PRODUCT",
    entityId: updatedProduct.id,
    description: `Updated product ${updatedProduct.name}.`,
  });
  return updatedProduct;
}
