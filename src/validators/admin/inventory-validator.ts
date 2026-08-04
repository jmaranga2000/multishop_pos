import { z } from "zod";

export const addStockSchema = z.object({
  shopId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  costPrice: z.coerce.number().nonnegative(),
  sellingPrice: z.coerce.number().positive(),
  reorderLevel: z.coerce.number().int().nonnegative(),
  criticalLevel: z.coerce.number().int().nonnegative(),
}).refine((value) => value.criticalLevel <= value.reorderLevel, {
  message: "Critical level cannot exceed reorder level.",
  path: ["criticalLevel"],
});

export const adjustStockSchema = z.object({
  inventoryId: z.string().min(1),
  quantity: z.coerce.number(),
  reason: z.string().trim().min(3).max(500),
});

export const updateInventorySchema = z.object({
  inventoryId: z.string().min(1),
  shopId: z.string().min(1),
  productId: z.string().min(1),
  costPrice: z.coerce.number().nonnegative(),
  sellingPrice: z.coerce.number().positive(),
  reorderLevel: z.coerce.number().int().nonnegative(),
  criticalLevel: z.coerce.number().int().nonnegative(),
  isAvailable: z.preprocess((v) => v === "on" || v === true, z.boolean()).optional(),
}).refine((value) => value.criticalLevel <= value.reorderLevel, {
  message: "Critical level cannot exceed reorder level.",
  path: ["criticalLevel"],
});
