"use server";

import { revalidatePath } from "next/cache";
import { requireShop } from "@/lib/rbac";
import { createPurchaseRequisition, receiveGoods } from "@/services/procurement/procurement-service";
import { createRequisitionSchema, receiveGoodsSchema } from "@/validators/procurement/procurement-validator";

function jsonField(formData: FormData, field: string) {
  const raw = formData.get(field);
  if (typeof raw !== "string" || !raw) throw new Error(`${field} is required.`);
  return JSON.parse(raw) as unknown;
}

function refresh() {
  revalidatePath("/shop/procurement");
  revalidatePath("/shop/stock");
  revalidatePath("/admin/procurement");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/dashboard");
}

export async function createShopRequisitionAction(formData: FormData) {
  const shop = await requireShop();
  const input = createRequisitionSchema.parse({ ...Object.fromEntries(formData), items: jsonField(formData, "itemsJson") });
  await createPurchaseRequisition(shop, input);
  refresh();
}

export async function receiveGoodsShopAction(formData: FormData) {
  const shop = await requireShop();
  const input = receiveGoodsSchema.parse({ ...Object.fromEntries(formData), items: jsonField(formData, "itemsJson") });
  await receiveGoods(shop, input);
  refresh();
}