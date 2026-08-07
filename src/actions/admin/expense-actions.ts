"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { createExpenseCategory, reviewExpense, toggleExpenseCategoryActive, updateExpenseCategory } from "@/services/admin/expense-service";
import { createExpenseCategorySchema, updateExpenseCategorySchema } from "@/validators/admin/expense-validator";
import { reviewExpenseSchema } from "@/validators/admin/review-validator";

export async function reviewExpenseAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = reviewExpenseSchema.parse(Object.fromEntries(formData));
  await reviewExpense(admin, input);
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/dashboard");
  redirect("/admin/expenses");
}

export async function createExpenseCategoryAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createExpenseCategorySchema.parse(Object.fromEntries(formData));
  await createExpenseCategory(admin, input);
  revalidatePath("/admin/expenses");
  redirect("/admin/expenses");
}

export async function updateExpenseCategoryAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = updateExpenseCategorySchema.parse(Object.fromEntries(formData));
  await updateExpenseCategory(admin, input);
  revalidatePath("/admin/expenses");
  revalidatePath(`/admin/expenses/${input.id}`);
  redirect(`/admin/expenses/${input.id}`);
}

export async function toggleExpenseCategoryAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = Object.fromEntries(formData);
  const categoryId = String(input.categoryId ?? "");
  const isActive = input.isActive === "true";
  await toggleExpenseCategoryActive(admin, { id: categoryId, isActive });
  revalidatePath("/admin/expenses");
  revalidatePath(`/admin/expenses/${categoryId}`);
}
