"use server";

import { redirect } from "next/navigation";
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

  try {
    const saleIdRaw = formData.get("saleId")?.toString();
    const receiptNumberRaw = formData.get("receiptNumber")?.toString();
    const input = createRefundRequestSchema.parse({
      saleId: saleIdRaw?.trim() ? saleIdRaw.trim() : undefined,
      receiptNumber: receiptNumberRaw?.trim() ? receiptNumberRaw.trim() : undefined,
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
    redirect("/shop/refund-request?success=Refund+request+submitted");
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    const message = error instanceof Error ? encodeURIComponent(error.message) : "Unable+to+submit+refund+request";
    redirect(`/shop/refund-request?error=${message}`);
  }
}
