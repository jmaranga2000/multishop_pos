"use server";

import { revalidatePath } from "next/cache";
import { requireShop } from "@/lib/rbac";
import { closeRegisterSession, openRegisterSession } from "@/services/shop/register-service";
import { closeRegisterSchema, openRegisterSchema } from "@/validators/shop/register-validator";

export async function openRegisterAction(formData: FormData) {
  const shopUser = await requireShop();
  const input = openRegisterSchema.parse(Object.fromEntries(formData));
  await openRegisterSession(shopUser, input);
  revalidatePath("/shop/register");
  revalidatePath("/shop/dashboard");
}

export async function closeRegisterAction(formData: FormData) {
  const shopUser = await requireShop();
  const input = closeRegisterSchema.parse(Object.fromEntries(formData));
  await closeRegisterSession(shopUser, input);
  revalidatePath("/shop/register");
  revalidatePath("/shop/dashboard");
}
