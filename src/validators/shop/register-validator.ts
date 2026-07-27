import { z } from "zod";

export const openRegisterSchema = z.object({
  registerId: z.string().min(1),
  openingCash: z.coerce.number().nonnegative(),
  salespersonId: z.string().optional(),
  pin: z.string().optional(),
  openingNote: z.string().trim().max(500).optional(),
});

export const closeRegisterSchema = z.object({
  sessionId: z.string().min(1),
  actualCash: z.coerce.number().nonnegative(),
  closingNote: z.string().trim().max(500).optional(),
});
