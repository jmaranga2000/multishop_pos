import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  creditLimitMinor: z.number().int().min(0).optional().default(0),
});

export const receiveCustomerPaymentSchema = z.object({
  amountMinor: z.number().int().min(1),
  method: z.enum(["CASH", "MPESA", "CARD", "BANK_TRANSFER"]),
  reference: z.string().optional().nullable(),
  registerSessionId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const createAdjustmentSchema = z.object({
  type: z.enum(["DEBIT_ADJUSTMENT", "CREDIT_ADJUSTMENT"]),
  amountMinor: z.number().int().min(1),
  reason: z.string().min(1, "Reason is required"),
  reference: z.string().optional().nullable(),
});

export const createLedgerEntrySchema = z.object({
  transactionId: z.string().min(1),
  type: z.enum(["CREDIT_SALE", "CUSTOMER_PAYMENT", "CUSTOMER_REFUND", "PRODUCT_RETURN", "DEBIT_ADJUSTMENT", "CREDIT_ADJUSTMENT", "OPENING_BALANCE", "REVERSAL"]),
  occurredAt: z.preprocess((v) => v ? new Date(String(v)) : new Date(), z.date()),
  reference: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  debitMinor: z.number().int().min(0),
  creditMinor: z.number().int().min(0),
  saleId: z.string().optional().nullable(),
  paymentId: z.string().optional().nullable(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type ReceiveCustomerPaymentInput = z.infer<typeof receiveCustomerPaymentSchema>;
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;
export type CreateLedgerEntryInput = z.infer<typeof createLedgerEntrySchema>;
