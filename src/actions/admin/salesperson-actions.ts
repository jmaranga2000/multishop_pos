"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { createSalesperson, setSalespersonActiveState } from "@/services/admin/salesperson-service";
import { createSalespersonSchema, toggleSalespersonSchema } from "@/validators/admin/salesperson-validator";

export async function createSalespersonAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createSalespersonSchema.parse(Object.fromEntries(formData));
  await createSalesperson(admin, input);
  revalidatePath("/admin/salespeople");
}

export async function toggleSalespersonAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = toggleSalespersonSchema.parse(Object.fromEntries(formData));
  await setSalespersonActiveState(admin, input);
  revalidatePath("/admin/salespeople");
}
