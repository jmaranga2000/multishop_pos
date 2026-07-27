"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { setDeviceAccess } from "@/services/admin/device-service";
import { deviceAccessSchema } from "@/validators/admin/device-validator";

export async function setDeviceAccessAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = deviceAccessSchema.parse(Object.fromEntries(formData));
  await setDeviceAccess(admin, input);
  revalidatePath("/admin/devices");
  revalidatePath("/admin/synchronization");
}
