"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { createStockTransfer, dispatchStockTransfer } from "@/services/admin/transfer-service";
import { createTransferSchema, transferIdSchema } from "@/validators/admin/transfer-validator";

export async function createTransferAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = createTransferSchema.parse(Object.fromEntries(formData));
  await createStockTransfer(admin, input);
  revalidatePath("/admin/transfers");
}

export async function dispatchTransferAction(formData: FormData) {
  const admin = await requireAdmin();
  const { transferId } = transferIdSchema.parse(Object.fromEntries(formData));
  await dispatchStockTransfer(admin, transferId);
  revalidatePath("/admin/transfers");
  revalidatePath("/admin/inventory");
}
