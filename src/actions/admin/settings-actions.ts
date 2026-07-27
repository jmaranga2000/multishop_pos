"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { updateBusinessSettings, updateNotificationPreferences } from "@/services/admin/settings-service";
import { businessSettingsSchema, notificationPreferencesSchema } from "@/validators/admin/settings-validator";

export async function updateBusinessSettingsAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = businessSettingsSchema.parse(Object.fromEntries(formData));
  await updateBusinessSettings(admin, input);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/dashboard");
  revalidatePath("/shop");
}

export async function updateNotificationPreferencesAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = notificationPreferencesSchema.parse(Object.fromEntries(formData));
  await updateNotificationPreferences(admin, input);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/notifications");
}
