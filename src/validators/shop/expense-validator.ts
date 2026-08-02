import { z } from "zod";

export const createExpenseSchema = z.object({
  categoryId: z.string().min(1),
  source: z.enum(["CASH", "MPESA"]),
  amount: z.coerce.number().positive(),
  description: z.string().trim().min(3).max(1000),
  occurredAt: z.coerce.date(),
});
