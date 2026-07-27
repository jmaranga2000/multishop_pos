"use server";

import { revalidatePath } from "next/cache";
import { requireShop } from "@/lib/rbac";
import { createShopRefundRequest } from "@/services/shop/refund-service";
import { createRefundRequestSchema } from "@/validators/shop/refund-validator";

export async function createRefundRequestAction(formData: FormData) {
  const shopUser = await requireShop();
  const input = createRefundRequestSchema.parse(Object.fromEntries(formData));
  await createShopRefundRequest(shopUser, input);
  revalidatePath("/shop/refund-request");
}
