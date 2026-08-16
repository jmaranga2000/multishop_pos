import { z } from "zod";

const optionalText = z.string().trim().max(1_000).optional().transform((value) => value || undefined);

export const stocktakeItemCountSchema = z.object({
  stocktakeItemId: z.string().min(1),
  physicalQuantity: z.coerce.number().min(0).max(1_000_000),
  varianceReason: z.enum([
    "DAMAGED_GOODS", "EXPIRED_GOODS", "THEFT_LOSS", "UNRECORDED_SALE",
    "RECEIVING_ERROR", "TRANSFER_ERROR", "COUNTING_ERROR", "DATA_ENTRY_ERROR", "OTHER",
  ]).optional(),
  reasonNote: optionalText,
});

export const createStocktakeSchema = z.object({
  shopId: z.string().min(1).optional(),
  notes: optionalText,
});

export const stocktakeIdSchema = z.object({
  stocktakeId: z.string().min(1),
  note: optionalText,
});

export const recordStocktakeCountsSchema = z.object({
  stocktakeId: z.string().min(1),
  items: z.array(stocktakeItemCountSchema).min(1).max(2_000),
});

export const rejectStocktakeSchema = z.object({
  stocktakeId: z.string().min(1),
  reason: z.string().trim().min(3).max(1_000),
});