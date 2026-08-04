import { db } from "@/lib/db";
import { randomUUID, createHash } from "node:crypto";
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

function generateSkuCandidate(name: string) {
  const prefix = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const suffix = randomUUID().slice(0, 4).toUpperCase();
  const base = prefix.length ? `${prefix}-${suffix}` : `PRD-${suffix}`;
  return base.slice(0, 60);
}

async function generateUniqueProductSku(name: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateSkuCandidate(name);
    const existing = await db.product.findFirst({ where: { sku: candidate } });
    if (!existing) return candidate;
  }

  return `${generateSkuCandidate(name)}-${randomUUID().slice(0, 4).toUpperCase()}`.slice(0, 60);
}

async function generateUniqueBarcode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = String(Math.floor(100000000000 + Math.random() * 900000000000));
    const existing = await db.product.findFirst({ where: { barcode: candidate } });
    if (!existing) return candidate;
  }

  let candidate = String(Math.floor(100000000000 + Math.random() * 900000000000));
  while (await db.product.findFirst({ where: { barcode: candidate } })) {
    candidate = String(Math.floor(100000000000 + Math.random() * 900000000000));
  }
  return candidate;
}

function normalizeEnvValue(value: string | undefined) {
  if (!value) return undefined;
  const t = value.trim();
  return t.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}

function extractCloudinaryPublicId(url: string, cloudName?: string) {
  try {
    const u = new URL(url);
    // pathname like /<cloudName>/image/upload/v12345/folder/name.jpg
    const parts = u.pathname.split("/").filter(Boolean);
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return null;
    const after = parts.slice(uploadIdx + 1).join("/");
    // remove version prefix v12345/
    const withoutVersion = after.replace(/^v\d+\//, "");
    // remove file extension
    const publicId = withoutVersion.replace(/\.[^.]+$/, "");
    return publicId;
  } catch (err) {
    return null;
  }
}

async function deleteCloudinaryImageIfExists(imageUrl: string | null | undefined) {
  const cloudName = normalizeEnvValue(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);
  const apiKey = normalizeEnvValue(process.env.CLOUDINARY_API_KEY);
  const apiSecret = normalizeEnvValue(process.env.CLOUDINARY_API_SECRET);
  if (!cloudName || !apiKey || !apiSecret || !imageUrl) return;

  const publicId = extractCloudinaryPublicId(imageUrl, cloudName);
  if (!publicId) return;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const stringToSign = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(stringToSign + apiSecret).digest("hex");

  const fd = new FormData();
  fd.append("public_id", publicId);
  fd.append("api_key", apiKey);
  fd.append("timestamp", timestamp);
  fd.append("signature", signature);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: "POST", body: fd });
    // ignore response details; best-effort cleanup
    await res.text();
  } catch (err) {
    // swallow errors to avoid breaking product update
    console.error("Cloudinary delete failed:", err);
  }
}

export async function listAdminProducts(businessId: string) {
  const [business, products] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.product.findMany({
      where: { businessId },
      include: { category: true, brand: true, unit: true, pricingUnits: { include: { unit: true } }, _count: { select: { inventory: true } } },
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
      include: { category: true, brand: true, unit: true, pricingUnits: { include: { unit: true } }, _count: { select: { inventory: true } } },
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
    include: { category: true, brand: true, unit: true, pricingUnits: true, _count: { select: { inventory: true } } },
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
  const firstUnitPricing = input.unitPricing?.[0] ?? null;
  const sku = input.sku?.trim() || await generateUniqueProductSku(input.name);
  const barcode = input.barcode?.trim() || await generateUniqueBarcode();
  const product = await db.product.create({
    data: {
      businessId: admin.businessId,
      name: input.name,
      sku,
      barcode,
      imageUrl: input.imageUrl ?? null,
      categoryId: input.categoryId || null,
      brandId: input.brandId || null,
      unitId: firstUnitPricing?.unitId ?? input.unitId ?? null,
      defaultCostPrice: firstUnitPricing?.costPrice ?? input.defaultCostPrice,
      defaultSellingPrice: firstUnitPricing?.sellingPrice ?? input.defaultSellingPrice,
    },
  });

  if (input.unitPricing?.length) {
    await db.productPricingUnit.deleteMany({ where: { productId: product.id } });
    await db.productPricingUnit.createMany({
      data: input.unitPricing.map((entry) => ({
        productId: product.id,
        unitId: entry.unitId,
        costPrice: entry.costPrice,
          multiplier: entry.multiplier ?? 1,
        sellingPrice: entry.sellingPrice,
      })),
    });
  }
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
  // If the product previously had an image but the incoming input clears it,
  // attempt to remove the image from Cloudinary (best-effort).
  if (product.imageUrl && (input.imageUrl === undefined || input.imageUrl === null)) {
    // don't block the update on deletion failures
    deleteCloudinaryImageIfExists(product.imageUrl).catch(() => {});
  }

  const firstUnitPricing = input.unitPricing?.[0] ?? null;
  const updatedProduct = await db.product.update({
    where: { id: input.productId },
    data: {
      name: input.name,
      sku: input.sku,
      barcode: input.barcode || null,
      imageUrl: input.imageUrl ?? null,
      categoryId: input.categoryId || null,
      brandId: input.brandId || null,
      unitId: firstUnitPricing?.unitId ?? input.unitId ?? null,
      defaultCostPrice: firstUnitPricing?.costPrice ?? input.defaultCostPrice,
      defaultSellingPrice: firstUnitPricing?.sellingPrice ?? input.defaultSellingPrice,
    },
  });

  await db.productPricingUnit.deleteMany({ where: { productId: updatedProduct.id } });
  if (input.unitPricing?.length) {
    await db.productPricingUnit.createMany({
      data: input.unitPricing.map((entry) => ({
        productId: updatedProduct.id,
        unitId: entry.unitId,
        costPrice: entry.costPrice,
        multiplier: entry.multiplier ?? 1,
        sellingPrice: entry.sellingPrice,
      })),
    });
  }

  await writeAuditLog(db, {
    userId: admin.id,
    action: "PRODUCT_UPDATED",
    entityType: "PRODUCT",
    entityId: updatedProduct.id,
    description: `Updated product ${updatedProduct.name}.`,
  });
  return updatedProduct;
}

export async function deleteProduct(admin: { id: string; businessId: string }, input: { id: string }) {
  const product = await db.product.findFirst({ where: { id: input.id, businessId: admin.businessId } });
  if (!product) throw new Error("Product not found.");

  await db.product.deleteMany({ where: { id: input.id } });
  await writeAuditLog(db, {
    userId: admin.id,
    action: "PRODUCT_DELETED",
    entityType: "PRODUCT",
    entityId: input.id,
    description: `Deleted product ${product.name}.`,
  });
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

export async function getAdminCategoryById(businessId: string, id: string) {
  return db.category.findFirst({ where: { id, businessId } });
}

export async function updateProductCategory(admin: { id: string; businessId: string }, input: { id: string; name: string }) {
  const category = await db.category.findFirst({ where: { id: input.id, businessId: admin.businessId } });
  if (!category) throw new Error("Category not found.");
  const slug = normalizeSlug(input.name);
  const updated = await db.category.update({ where: { id: input.id }, data: { name: input.name, slug } });
  await writeAuditLog(db, {
    userId: admin.id,
    action: "PRODUCT_CATEGORY_UPDATED",
    entityType: "CATEGORY",
    entityId: updated.id,
    description: `Updated category ${updated.name}.`,
  });
  return updated;
}

export async function getAdminBrandById(businessId: string, id: string) {
  return db.brand.findFirst({ where: { id, businessId } });
}

export async function updateProductBrand(admin: { id: string; businessId: string }, input: { id: string; name: string }) {
  const brand = await db.brand.findFirst({ where: { id: input.id, businessId: admin.businessId } });
  if (!brand) throw new Error("Brand not found.");
  const updated = await db.brand.update({ where: { id: input.id }, data: { name: input.name } });
  await writeAuditLog(db, {
    userId: admin.id,
    action: "PRODUCT_BRAND_UPDATED",
    entityType: "BRAND",
    entityId: updated.id,
    description: `Updated brand ${updated.name}.`,
  });
  return updated;
}

export async function getAdminUnitById(businessId: string, id: string) {
  return db.unit.findFirst({ where: { id, businessId } });
}

export async function updateProductUnit(admin: { id: string; businessId: string }, input: { id: string; name: string; symbol: string }) {
  const unit = await db.unit.findFirst({ where: { id: input.id, businessId: admin.businessId } });
  if (!unit) throw new Error("Unit not found.");
  const updated = await db.unit.update({ where: { id: input.id }, data: { name: input.name, symbol: input.symbol } });
  await writeAuditLog(db, {
    userId: admin.id,
    action: "PRODUCT_UNIT_UPDATED",
    entityType: "UNIT",
    entityId: updated.id,
    description: `Updated unit ${updated.name}.`,
  });
  return updated;
}

export async function toggleProductCategoryActive(admin: { id: string; businessId: string }, input: { id: string; isActive: boolean }) {
  const category = await db.category.findFirst({ where: { id: input.id, businessId: admin.businessId } });
  if (!category) throw new Error("Category not found.");
  const updated = await db.category.update({ where: { id: input.id }, data: { isActive: input.isActive } });
  await writeAuditLog(db, {
    userId: admin.id,
    action: input.isActive ? "PRODUCT_CATEGORY_ACTIVATED" : "PRODUCT_CATEGORY_SUSPENDED",
    entityType: "CATEGORY",
    entityId: updated.id,
    description: `${input.isActive ? "Activated" : "Suspended"} category ${updated.name}.`,
  });
  return updated;
}

export async function deleteProductCategory(admin: { id: string; businessId: string }, input: { id: string }) {
  const category = await db.category.findFirst({ where: { id: input.id, businessId: admin.businessId } });
  if (!category) throw new Error("Category not found.");
  await db.category.deleteMany({ where: { id: input.id } });
  await writeAuditLog(db, {
    userId: admin.id,
    action: "PRODUCT_CATEGORY_DELETED",
    entityType: "CATEGORY",
    entityId: input.id,
    description: `Deleted category ${category.name}.`,
  });
}

export async function toggleProductBrandActive(admin: { id: string; businessId: string }, input: { id: string; isActive: boolean }) {
  const brand = await db.brand.findFirst({ where: { id: input.id, businessId: admin.businessId } });
  if (!brand) throw new Error("Brand not found.");
  const updated = await db.brand.update({ where: { id: input.id }, data: { isActive: input.isActive } });
  await writeAuditLog(db, {
    userId: admin.id,
    action: input.isActive ? "PRODUCT_BRAND_ACTIVATED" : "PRODUCT_BRAND_SUSPENDED",
    entityType: "BRAND",
    entityId: updated.id,
    description: `${input.isActive ? "Activated" : "Suspended"} brand ${updated.name}.`,
  });
  return updated;
}

export async function deleteProductBrand(admin: { id: string; businessId: string }, input: { id: string }) {
  const brand = await db.brand.findFirst({ where: { id: input.id, businessId: admin.businessId } });
  if (!brand) throw new Error("Brand not found.");
  await db.brand.deleteMany({ where: { id: input.id } });
  await writeAuditLog(db, {
    userId: admin.id,
    action: "PRODUCT_BRAND_DELETED",
    entityType: "BRAND",
    entityId: input.id,
    description: `Deleted brand ${brand.name}.`,
  });
}

export async function deleteProductUnit(admin: { id: string; businessId: string }, input: { id: string }) {
  const unit = await db.unit.findFirst({ where: { id: input.id, businessId: admin.businessId } });
  if (!unit) throw new Error("Unit not found.");
  await db.unit.deleteMany({ where: { id: input.id } });
  await writeAuditLog(db, {
    userId: admin.id,
    action: "PRODUCT_UNIT_DELETED",
    entityType: "UNIT",
    entityId: input.id,
    description: `Deleted unit ${unit.name}.`,
  });
}
