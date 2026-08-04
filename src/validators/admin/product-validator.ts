import { z } from "zod";

const pricingEntrySchema = z.object({
  unitId: z.string().min(1),
  costPrice: z.coerce.number().nonnegative(),
  sellingPrice: z.coerce.number().positive(),
  multiplier: z.coerce.number().int().positive().optional().default(1),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(160),
  sku: z.string().trim().max(60).optional().transform((value) => value?.length ? value.toUpperCase() : undefined),
  barcode: z.string().trim().max(80).optional().transform((value) => value?.length ? value : undefined),
  imageUrl: z.preprocess((val) => {
    if (typeof val === "string") {
      const t = val.trim();
      return t.length ? t : undefined;
    }
    return val;
  }, z.string().url().optional()),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  unitId: z.string().optional(),
  defaultCostPrice: z.coerce.number().nonnegative(),
  defaultSellingPrice: z.coerce.number().positive(),
  unitPricing: z.string().optional().transform((value) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      const array = Array.isArray(parsed) ? parsed : [];
      return pricingEntrySchema.array().parse(array);
    } catch {
      return [];
    }
  }),
});

export const updateProductSchema = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(2).max(160),
  sku: z.string().trim().min(2).max(60).transform((value) => value.toUpperCase()),
  barcode: z.string().trim().max(80).optional(),
  imageUrl: z.preprocess((val) => {
    if (typeof val === "string") {
      const t = val.trim();
      return t.length ? t : undefined;
    }
    return val;
  }, z.string().url().optional()),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  unitId: z.string().optional(),
  defaultCostPrice: z.coerce.number().nonnegative(),
  defaultSellingPrice: z.coerce.number().positive(),
  unitPricing: z.string().optional().transform((value) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      const array = Array.isArray(parsed) ? parsed : [];
      return pricingEntrySchema.array().parse(array);
    } catch {
      return [];
    }
  }),
});

export const createProductCategorySchema = z.object({
  name: z.string().trim().min(2).max(160),
});

export const createProductBrandSchema = z.object({
  name: z.string().trim().min(2).max(160),
});

export const createProductUnitSchema = z.object({
  name: z.string().trim().min(1).max(80),
  symbol: z.string().trim().min(1).max(10),
});

export const updateProductCategorySchema = createProductCategorySchema.extend({ id: z.string().min(1) });
export const updateProductBrandSchema = createProductBrandSchema.extend({ id: z.string().min(1) });
export const updateProductUnitSchema = createProductUnitSchema.extend({ id: z.string().min(1) });
