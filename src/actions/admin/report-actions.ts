"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { generateInventoryReportNow } from "@/services/admin/report-service";

export async function generateInventoryReportAction() {
  const admin = await requireAdmin();
  await generateInventoryReportNow(admin.businessId);
  revalidatePath("/admin/reports/inventory");
  revalidatePath("/admin/notifications");
}
