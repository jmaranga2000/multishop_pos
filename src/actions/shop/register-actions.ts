"use server";

import argon2 from "argon2";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireShop } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { closeRegisterSession, openRegisterSession } from "@/services/shop/register-service";
import { closeRegisterSchema, openRegisterSchema } from "@/validators/shop/register-validator";

export async function openRegisterAction(formData: FormData) {
  const shopUser = await requireShop();
  try {
    const input = openRegisterSchema.parse(Object.fromEntries(formData));
    await openRegisterSession(shopUser, input);
    revalidatePath("/shop/register");
    revalidatePath("/shop/dashboard");
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    const message = error instanceof AppError ? error.message : "Unable to open the register session.";
    redirect(`/shop/register?error=${encodeURIComponent(message)}`);
  }
}

export async function closeRegisterAction(formData: FormData) {
  const shopUser = await requireShop();
  try {
    const input = closeRegisterSchema.parse(Object.fromEntries(formData));
    await closeRegisterSession(shopUser, input);
    revalidatePath("/shop/register");
    revalidatePath("/shop/dashboard");
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    const message = error instanceof AppError ? error.message : "Unable to close the register session.";
    redirect(`/shop/register?error=${encodeURIComponent(message)}`);
  }
}

export async function unlockShopPortalAction(formData: FormData) {
  const shopUser = await requireShop();
  const salespersonId = String(formData.get("salespersonId") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!salespersonId || !pin) {
    return { success: false, error: "A valid salesperson ID and PIN are required." };
  }

  const openSession = await db.registerSession.findFirst({
    where: { shopId: shopUser.shopId, status: "OPEN", salespersonId },
    include: { salesperson: true },
  });

  if (!openSession || !openSession.salesperson) {
    return { success: false, error: "No active salesperson session is available to unlock." };
  }

  const validPin = await argon2.verify(openSession.salesperson.pinHash, pin);
  if (!validPin) {
    return { success: false, error: "The salesperson PIN is incorrect." };
  }

  return { success: true };
}
