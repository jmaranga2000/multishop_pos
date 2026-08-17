"use server";

import { revalidatePath } from "next/cache";
import { requireShop } from "@/lib/rbac";
import { AppError } from "@/lib/errors/app-error";
import { cancelStocktake, recordStocktakeCounts, startStocktake, submitStocktake } from "@/services/stocktake/stocktake-service";
import { createStocktakeSchema, recordStocktakeCountsSchema, stocktakeIdSchema } from "@/validators/stocktake/stocktake-validator";

function jsonField(formData: FormData, field: string) {
  const raw = formData.get(field);
  if (typeof raw !== "string" || !raw) throw new Error(`${field} is required.`);
  return JSON.parse(raw) as unknown;
}

function refresh() {
  revalidatePath("/shop/stocktake");
  revalidatePath("/shop/stock");
  revalidatePath("/admin/stocktakes");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/dashboard");
}

export async function startShopStocktakeAction(formData: FormData) {
  const shop = await requireShop();
  await startStocktake(shop, createStocktakeSchema.parse(Object.fromEntries(formData)));
  refresh();
}

export async function recordStocktakeCountsAction(formData: FormData) {
  try {
    const shop = await requireShop();
    const input = recordStocktakeCountsSchema.parse({ ...Object.fromEntries(formData), items: jsonField(formData, "itemsJson") });
    await recordStocktakeCounts(shop, input);
    refresh();
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof AppError ? error.message : "Unable to save this stock count. Please try again.",
    };
  }
}

export async function submitStocktakeAction(formData: FormData) {
  const shop = await requireShop();
  await submitStocktake(shop, stocktakeIdSchema.parse(Object.fromEntries(formData)));
  refresh();
}

export async function cancelStocktakeAction(formData: FormData) {
  const shop = await requireShop();
  await cancelStocktake(shop, stocktakeIdSchema.parse(Object.fromEntries(formData)));
  refresh();
}