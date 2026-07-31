import { db } from "@/lib/db";
import { writeAuditLog } from "@/services/shared/audit-service";
import type { z } from "zod";
import type {
  createProductSchema,
  updateProductSchema,
  createProductCategorySchema,
  createProductBrandSchema,
  createProductUnitSchema,
} from "@/validators/admin/product-validator";

type CreateProductInput = z.infer<typeof createProductSchema>;
type UpdateProductInput = z.infer<typeof updateProductSchema>;
type CreateProductCategoryInput = z.infer<typeof createProductCategorySchema>;
type CreateProductBrandInput = z.infer<typeof createProductBrandSchema>;
type CreateProductUnitInput = z.infer<typeof createProductUnitSchema>;

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 240);
}

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

export async function listAdminProductCategories(businessId: string) {
  return db.category.findMany({ where: { businessId }, orderBy: { name: "asc" } });
}

export async function listAdminProductBrands(businessId: string) {
  return db.brand.findMany({ where: { businessId }, orderBy: { name: "asc" } });
}

export async function listAdminProductUnits(businessId: string) {
  return db.unit.findMany({ where: { businessId }, orderBy: { name: "asc" } });
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

export async function createProductCategory(admin: { id: string; businessId: string }, input: CreateProductCategoryInput) {
  const slug = normalizeSlug(input.name);
  const category = await db.category.create({
    data: {
      businessId: admin.businessId,
      name: input.name,
      slug,
      isActive: true,
    },
  });
  await writeAuditLog(db, {
    userId: admin.id,
    action: "PRODUCT_CATEGORY_CREATED",
    entityType: "CATEGORY",
    entityId: category.id,
    description: `Created product category ${category.name}.`,
  });
  return category;
}

export async function createProductBrand(admin: { id: string; businessId: string }, input: CreateProductBrandInput) {
  const brand = await db.brand.create({
    data: {
      businessId: admin.businessId,
      name: input.name,
      isActive: true,
    },
  });
  await writeAuditLog(db, {
    userId: admin.id,
    action: "PRODUCT_BRAND_CREATED",
    entityType: "BRAND",
    entityId: brand.id,
    description: `Created product brand ${brand.name}.`,
  });
  return brand;
}

export async function createProductUnit(admin: { id: string; businessId: string }, input: CreateProductUnitInput) {
  const unit = await db.unit.create({
    data: {
      businessId: admin.businessId,
      name: input.name,
      symbol: input.symbol,
    },
  });
  await writeAuditLog(db, {
    userId: admin.id,
    action: "PRODUCT_UNIT_CREATED",
    entityType: "UNIT",
    entityId: unit.id,
    description: `Created product unit ${unit.name}.`,
  });
  return unit;
}
