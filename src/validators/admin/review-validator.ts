import { z } from "zod";

export const reviewExpenseSchema = z.object({
  expenseId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export const reviewRefundSchema = z.object({
  refundRequestId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().trim().max(500).optional(),
});
