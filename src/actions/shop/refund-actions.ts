"use server";

import { revalidatePath } from "next/cache";
import { requireShop } from "@/lib/rbac";
import { createShopRefundRequest } from "@/services/shop/refund-service";
import { createRefundRequestSchema } from "@/validators/shop/refund-validator";

function parseBooleanEntry(value: FormDataEntryValue | null) {
  if (value === null) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "on" || normalized === "1";
  }
  return Boolean(value);
}

export async function createRefundRequestAction(formData: FormData) {
  const shopUser = await requireShop();
  const input = createRefundRequestSchema.parse({
    saleId: formData.get("saleId")?.toString() ?? undefined,
    receiptNumber: formData.get("receiptNumber")?.toString() ?? undefined,
    requestType: formData.get("requestType")?.toString() ?? "FULL_SALE",
    refundMethod: formData.get("refundMethod")?.toString() ?? "CASH",
    selectedItemIds: formData.getAll("selectedItemIds").map((entry) => entry.toString()),
    restockReturnedProducts: parseBooleanEntry(formData.get("restockReturnedProducts")),
    markItemsAsDamaged: parseBooleanEntry(formData.get("markItemsAsDamaged")),
    requestManagerApproval: parseBooleanEntry(formData.get("requestManagerApproval")),
    reason: formData.get("reason")?.toString() ?? "",
  });
  await createShopRefundRequest(shopUser, input);
  revalidatePath("/shop/refund-request");
}
