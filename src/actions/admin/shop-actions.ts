"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { createShopWithAccount, resetShopPassword, setShopActiveState, setShopArchivedState } from "@/services/admin/shop-service";
import { updateShopAndAccount } from "@/services/admin/shop-service";
import { createShopSchema, resetShopPasswordSchema, toggleShopSchema, updateShopSchema, toggleArchiveSchema } from "@/validators/admin/shop-validator";

export async function createShopAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createShopSchema.parse(Object.fromEntries(formData));
  await createShopWithAccount(admin, input);
  revalidatePath("/admin/shops");
  redirect("/admin/shops");
}

export async function resetShopPasswordAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = resetShopPasswordSchema.parse(Object.fromEntries(formData));
  await resetShopPassword(admin, input);
  revalidatePath("/admin/shops");
  redirect("/admin/shops");
}

export async function toggleShopAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = toggleShopSchema.parse(Object.fromEntries(formData));
  await setShopActiveState(admin, input);
  revalidatePath("/admin/shops");
  redirect("/admin/shops");
}

export async function archiveShopAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = toggleArchiveSchema.parse(Object.fromEntries(formData));
  await setShopArchivedState(admin, input);
  revalidatePath("/admin/shops");
  redirect("/admin/shops");
}

export async function updateShopAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = updateShopSchema.parse(Object.fromEntries(formData));
  await updateShopAndAccount(admin, input);
  revalidatePath("/admin/shops");
  redirect("/admin/shops");
}
