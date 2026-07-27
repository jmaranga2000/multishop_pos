"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { reviewRefundRequest } from "@/services/admin/refund-service";
import { reviewRefundSchema } from "@/validators/admin/review-validator";

export async function reviewRefundAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = reviewRefundSchema.parse(Object.fromEntries(formData));
  await reviewRefundRequest(admin, input);
  revalidatePath("/admin/refunds");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/sales");
}
