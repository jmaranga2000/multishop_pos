"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { createShopWithAccount, resetShopPassword, setShopActiveState } from "@/services/admin/shop-service";
import { createShopSchema, resetShopPasswordSchema, toggleShopSchema } from "@/validators/admin/shop-validator";

export async function createShopAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createShopSchema.parse(Object.fromEntries(formData));
  await createShopWithAccount(admin, input);
  revalidatePath("/admin/shops");
}

export async function resetShopPasswordAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = resetShopPasswordSchema.parse(Object.fromEntries(formData));
  await resetShopPassword(admin, input);
  revalidatePath("/admin/shops");
}

export async function toggleShopAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = toggleShopSchema.parse(Object.fromEntries(formData));
  await setShopActiveState(admin, input);
  revalidatePath("/admin/shops");
}
