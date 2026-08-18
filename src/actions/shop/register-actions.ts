"use server";

import argon2 from "argon2";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireShop } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { closeRegisterSession, openRegisterSession } from "@/services/shop/register-service";
import { consumeBiometricAuthentication } from "@/services/shop/biometric-service";
import { closeRegisterSchema, openRegisterSchema } from "@/validators/shop/register-validator";
import { getCountersByShop } from "@/services/admin/counter-service";
import crypto from "crypto";
import { cookies } from "next/headers";
import { createCounterAccessToken, counterAccessCookieName } from "@/lib/auth";

export async function unlockCounterAction(pin: string) {
  const shopUser = await requireShop();
  if (!/^\d{6}$/.test(pin)) return { success: false, error: "Enter the six-digit counter PIN." };
  const fingerprint = crypto.createHmac("sha256", process.env.AUTH_SECRET as string).update(`${shopUser.shopId}:${pin}`).digest("hex");
  const counter = await db.counter.findFirst({ where: { shopId: shopUser.shopId, pinFingerprint: fingerprint, status: "ACTIVE" } });
  if (!counter || !counter.pinHash || !(await argon2.verify(counter.pinHash, pin))) {
    return { success: false, error: "The counter PIN is incorrect or inactive." };
  }
  const cookieStore = await cookies();
  cookieStore.set(counterAccessCookieName(), createCounterAccessToken(shopUser.id, counter.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return { success: true, counterName: counter.name };
}

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

export async function getCountersForShopAction() {
  try {
    const shopUser = await requireShop();
    const counters = await getCountersByShop(shopUser.shopId);
    return { success: true, data: counters };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

export async function unlockShopPortalAction(formData: FormData) {
  const shopUser = await requireShop();
  const salespersonId = String(formData.get("salespersonId") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!salespersonId) {
    return { success: false, error: "A valid salesperson ID is required." };
  }

  const openSession = await db.registerSession.findFirst({
    where: { shopId: shopUser.shopId, status: "OPEN", salespersonId },
    include: { salesperson: true },
  });

  if (!openSession || !openSession.salesperson) {
    return { success: false, error: "No active salesperson session is available to unlock." };
  }

  const biometricAuthToken = String(formData.get("biometricAuthToken") ?? "").trim();
  const biometricVerified = biometricAuthToken
    ? await consumeBiometricAuthentication({
        authenticationToken: biometricAuthToken,
        salespersonId,
        shopId: shopUser.shopId,
      })
    : false;

  if (biometricVerified) {
    return { success: true };
  }

  if (!pin) {
    return { success: false, error: "A valid salesperson PIN or fingerprint is required." };
  }

  const validPin = await argon2.verify(openSession.salesperson.pinHash, pin);
  if (!validPin) {
    return { success: false, error: "The salesperson PIN is incorrect." };
  }

  return { success: true };
}
