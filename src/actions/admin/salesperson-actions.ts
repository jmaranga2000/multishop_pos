"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { createSalesperson, setSalespersonActiveState, updateSalesperson } from "@/services/admin/salesperson-service";
import { createSalespersonSchema, toggleSalespersonSchema, updateSalespersonSchema } from "@/validators/admin/salesperson-validator";

export async function createSalespersonAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createSalespersonSchema.parse(Object.fromEntries(formData));
  await createSalesperson(admin, input);
  revalidatePath("/admin/salespeople");
  redirect("/admin/salespeople");
}

export async function updateSalespersonAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = updateSalespersonSchema.parse(Object.fromEntries(formData));
  await updateSalesperson(admin, input);
  revalidatePath(`/admin/salespeople/${input.salespersonId}`);
  revalidatePath("/admin/salespeople");
  redirect("/admin/salespeople");
}

export async function toggleSalespersonAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = toggleSalespersonSchema.parse(Object.fromEntries(formData));
  await setSalespersonActiveState(admin, input);
  revalidatePath(`/admin/salespeople/${input.salespersonId}`);
  revalidatePath("/admin/salespeople");
  redirect("/admin/salespeople");
}
