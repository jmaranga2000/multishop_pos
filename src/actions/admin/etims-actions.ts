"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { updateEtimsConfiguration, updateTaxSettings } from "@/services/admin/etims-settings-service";
import { etimsConfigurationSchema, taxSettingsSchema } from "@/validators/admin/etims-validator";

export async function updateTaxSettingsAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = taxSettingsSchema.parse(Object.fromEntries(formData));
  await updateTaxSettings(admin, input);
  revalidatePath("/admin/settings");
  revalidatePath("/shop/pos");
}

export async function updateEtimsConfigurationAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = etimsConfigurationSchema.parse(Object.fromEntries(formData));
  await updateEtimsConfiguration(admin, input);
  revalidatePath("/admin/settings");
  revalidatePath("/shop/pos");
  revalidatePath("/admin/etims");
}