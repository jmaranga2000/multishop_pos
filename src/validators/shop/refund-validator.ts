import { z } from "zod";

export const createRefundRequestSchema = z.object({
  receiptNumber: z.string().trim().min(3).max(100),
  reason: z.string().trim().min(5).max(1000),
});
