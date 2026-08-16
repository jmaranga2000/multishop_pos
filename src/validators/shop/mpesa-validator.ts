import { z } from "zod";

export const startMpesaPaymentSchema = z.object({
  registerSessionId: z.string().trim().min(1).max(100),
  saleLocalReference: z.string().uuid(),
  mode: z.enum(["STK_PUSH", "PAY_TO_TILL"]),
  expectedAmountMinor: z.number().int().positive(),
  customerPhone: z.string().trim().max(32).nullable().optional(),
  clientReference: z.string().trim().max(160).nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(220).nullable().optional(),
});