import { z } from "zod";

const paymentSchema = z.object({
  method: z.enum(["CASH", "MPESA", "CARD", "BANK_TRANSFER", "CREDIT"]),
  amountMinor: z.number().int().positive(),
  reference: z.string().trim().max(160).nullable().optional(),
});

const itemSchema = z.object({
  productId: z.string().min(1),
  unitId: z.string().min(1).nullable().optional(),
  quantity: z.number().positive(),
});

export const etimsCheckoutSchema = z.object({
  checkoutRequestId: z.string().uuid(),
  registerSessionId: z.string().min(1),
  customerId: z.string().min(1).nullable().optional(),
  customerName: z.string().trim().max(160).nullable().optional(),
  discountMinor: z.number().int().nonnegative().default(0),
  note: z.string().trim().max(500).nullable().optional(),
  payments: z.array(paymentSchema).min(1),
  items: z.array(itemSchema).min(1),
});