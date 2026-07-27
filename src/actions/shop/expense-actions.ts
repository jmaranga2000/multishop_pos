"use server";

import { revalidatePath } from "next/cache";
import { requireShop } from "@/lib/rbac";
import { createShopExpense } from "@/services/shop/expense-service";
import { createExpenseSchema } from "@/validators/shop/expense-validator";

export async function createExpenseAction(formData: FormData) {
  const shopUser = await requireShop();
  const input = createExpenseSchema.parse(Object.fromEntries(formData));
  await createShopExpense(shopUser, input);
  revalidatePath("/shop/expenses");
}
