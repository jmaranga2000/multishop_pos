import { z } from "zod";

const denominationSchema = z.coerce.number().nonnegative().optional();

export const openRegisterSchema = z.object({
  counterId: z.string().min(1),
  registerId: z.string().min(1),
  openingCash: z.coerce.number().nonnegative(),
  salespersonId: z.string().min(1),
  pin: z.string().trim().optional(),
  biometricAuthToken: z.string().trim().optional(),
  openingNote: z.string().trim().max(500).optional(),
  openingCashSource: z.string().trim().max(100).optional(),
  openingMpesaBalance: z.coerce.number().nonnegative().optional(),
  openingMpesaBalanceMethod: z.string().trim().max(100).optional(),
  openingMpesaVerifiedBy: z.string().trim().max(100).optional(),
  openingMpesaReference: z.string().trim().max(200).optional(),
  idempotencyKey: z.string().trim().max(200).optional(),
  enabledPaymentChannels: z.string().optional(),
  cashDenomination1000: denominationSchema,
  cashDenomination500: denominationSchema,
  cashDenomination200: denominationSchema,
  cashDenomination100: denominationSchema,
  cashDenomination50: denominationSchema,
  cashDenomination20: denominationSchema,
  cashDenomination10: denominationSchema,
  cashDenomination5: denominationSchema,
  cashDenomination1: denominationSchema,
});

export const closeRegisterSchema = z.object({
  sessionId: z.string().min(1),
  actualCash: z.coerce.number().nonnegative(),
  actualMpesaBalance: z.coerce.number().nonnegative().optional(),
  closingNote: z.string().trim().max(500).optional(),
  varianceReason: z.string().trim().max(500).optional(),
  closingMpesaBalanceMethod: z.string().trim().max(100).optional(),
  closingMpesaVerifiedBy: z.string().trim().max(100).optional(),
  closingMpesaReference: z.string().trim().max(200).optional(),
  unresolvedClosureReason: z.string().trim().max(500).optional(),
  approvedBy: z.string().trim().max(100).optional(),
  idempotencyKey: z.string().trim().max(200).optional(),
});
