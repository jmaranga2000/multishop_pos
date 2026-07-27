import { z } from "zod";

export const createTransferSchema = z.object({
  sourceShopId: z.string().min(1),
  destinationShopId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  note: z.string().trim().max(500).optional(),
}).refine((value) => value.sourceShopId !== value.destinationShopId, {
  message: "Source and destination shops must be different.",
  path: ["destinationShopId"],
});

export const transferIdSchema = z.object({ transferId: z.string().min(1) });
