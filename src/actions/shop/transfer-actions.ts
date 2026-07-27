"use server";

import { revalidatePath } from "next/cache";
import { requireShop } from "@/lib/rbac";
import { receiveIncomingTransfer } from "@/services/shop/transfer-service";
import { receiveTransferSchema } from "@/validators/shop/transfer-validator";

export async function receiveTransferAction(formData: FormData) {
  const shopUser = await requireShop();
  const { transferId } = receiveTransferSchema.parse(Object.fromEntries(formData));
  await receiveIncomingTransfer(shopUser, transferId);
  revalidatePath("/shop/transfers");
  revalidatePath("/shop/stock");
  revalidatePath("/admin/transfers");
}
