import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(160),
  sku: z.string().trim().min(2).max(60).transform((value) => value.toUpperCase()),
  barcode: z.string().trim().max(80).optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  unitId: z.string().optional(),
  defaultCostPrice: z.coerce.number().nonnegative(),
  defaultSellingPrice: z.coerce.number().positive(),
});
