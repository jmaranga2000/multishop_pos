"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { markAllNotificationsRead, markNotificationRead } from "@/services/admin/notification-service";
import { notificationIdSchema } from "@/validators/admin/notification-validator";

export async function markNotificationReadAction(formData: FormData) {
  const admin = await requireAdmin();
  const { notificationId } = notificationIdSchema.parse(Object.fromEntries(formData));
  await markNotificationRead(admin.id, notificationId);
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}

export async function markAllNotificationsReadAction() {
  const admin = await requireAdmin();
  await markAllNotificationsRead(admin.id);
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}
