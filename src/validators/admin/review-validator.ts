import { z } from "zod";

export const reviewExpenseSchema = z.object({
  expenseId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export const reviewRefundSchema = z.object({
  refundRequestId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().trim().max(500).optional(),
}).refine((value) => value.decision !== "APPROVED" || !value.reviewNote || value.reviewNote.trim().length >= 5, {
  message: "Approval requires a review note of at least 5 characters.",
  path: ["reviewNote"],
});
