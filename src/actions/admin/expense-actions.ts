"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { reviewExpense } from "@/services/admin/expense-service";
import { reviewExpenseSchema } from "@/validators/admin/review-validator";

export async function reviewExpenseAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = reviewExpenseSchema.parse(Object.fromEntries(formData));
  await reviewExpense(admin, input);
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/dashboard");
}
