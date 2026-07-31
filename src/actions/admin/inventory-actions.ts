"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { addStock, adjustStock } from "@/services/admin/inventory-service";
import { addStockSchema, adjustStockSchema } from "@/validators/admin/inventory-validator";
import { updateInventorySchema } from "@/validators/admin/inventory-validator";
import { updateInventory } from "@/services/admin/inventory-service";

export async function addStockAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = addStockSchema.parse(Object.fromEntries(formData));
  await addStock(admin, input);
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/dashboard");
  redirect("/admin/inventory");
}

export async function adjustStockAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = adjustStockSchema.parse(Object.fromEntries(formData));
  await adjustStock(admin, input);
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/dashboard");
  redirect("/admin/inventory");
}

export async function updateInventoryAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = updateInventorySchema.parse(Object.fromEntries(formData));
  await updateInventory(admin, input);
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/dashboard");
  redirect(`/admin/inventory/${input.inventoryId}`);
}
