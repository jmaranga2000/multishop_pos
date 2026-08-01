import { z } from "zod";

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(2, "Expense category name must be at least 2 characters."),
});

export const updateExpenseCategorySchema = createExpenseCategorySchema.extend({
  id: z.string().min(1, "Expense category id is required."),
});
