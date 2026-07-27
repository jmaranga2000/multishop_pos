"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { resolveSynchronizationConflict } from "@/services/admin/synchronization-service";
import { resolveSyncConflictSchema } from "@/validators/admin/synchronization-validator";

export async function resolveSynchronizationConflictAction(formData: FormData) {
  const admin = await requireAdmin();
  const { conflictId } = resolveSyncConflictSchema.parse(Object.fromEntries(formData));
  await resolveSynchronizationConflict(admin, conflictId);
  revalidatePath("/admin/synchronization");
  revalidatePath("/admin/devices");
}
