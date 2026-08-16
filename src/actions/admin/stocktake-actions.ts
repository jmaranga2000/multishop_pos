"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/rbac";
import { approveStocktake, rejectStocktake, startStocktake } from "@/services/stocktake/stocktake-service";
import { createStocktakeSchema, rejectStocktakeSchema, stocktakeIdSchema } from "@/validators/stocktake/stocktake-validator";

function refresh() {
  revalidatePath("/admin/stocktakes");
  revalidatePath("/admin/procurement");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/dashboard");
  revalidatePath("/shop/stocktake");
  revalidatePath("/shop/stock");
}

export async function startAdminStocktakeAction(formData: FormData) {
  const admin = await requireAdmin();
  await startStocktake(admin, createStocktakeSchema.parse(Object.fromEntries(formData)));
  refresh();
}

export async function approveStocktakeAction(formData: FormData) {
  const admin = await requireAdmin();
  await approveStocktake(admin, stocktakeIdSchema.parse(Object.fromEntries(formData)));
  refresh();
}

export async function rejectStocktakeAction(formData: FormData) {
  const admin = await requireAdmin();
  await rejectStocktake(admin, rejectStocktakeSchema.parse(Object.fromEntries(formData)));
  refresh();
}