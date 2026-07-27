import crypto from "crypto";
import argon2 from "argon2";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServiceRoleClient } from "./supabase";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SESSION_COOKIE_NAME = "multishop-pos-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const AUTH_SECRET = process.env.AUTH_SECRET as string;

if (!AUTH_SECRET) {
  throw new Error("AUTH_SECRET is required for production authentication.");
}

if (!supabaseServiceRoleClient) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to access the Supabase service role client.");
}

const svc = supabaseServiceRoleClient!;

type SessionPayload = {
  userId: string;
  passwordVersion: number;
  issuedAt: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
}

function createSessionToken(payload: Omit<SessionPayload, "issuedAt">) {
  const data = JSON.stringify({ ...payload, issuedAt: Date.now() });
  const encoded = base64UrlEncode(data);
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

function verifySessionToken(token: string) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = signPayload(encoded);
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  const raw = base64UrlDecode(encoded);
  const payload = JSON.parse(raw) as SessionPayload;
  if (!payload || typeof payload.userId !== "string" || typeof payload.passwordVersion !== "number" || typeof payload.issuedAt !== "number") {
    return null;
  }

  if (Date.now() - payload.issuedAt > SESSION_MAX_AGE_SECONDS * 1000) {
    return null;
  }

  return payload;
}

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SHOP";
  businessId: string;
  shopId?: string | null;
  passwordVersion: number;
  status: string;
  shop?: { id: string; name: string; code: string; isActive: boolean } | null;
};

export async function authenticateUser(email: string, password: string) {
  const parsed = credentialsSchema.safeParse({ email, password });
  if (!parsed.success) return null;

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const { data: user, error } = await svc
    .from("\"User\"")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error || !user || user.status !== "ACTIVE") return null;
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) return null;

  const valid = await argon2.verify(user.passwordHash, parsed.data.password);
  if (!valid) {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    await svc
      .from("\"User\"")
      .update({
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
      })
      .eq("id", user.id);
    return null;
  }

  await svc
    .from("\"User\"")
    .update({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
    .eq("id", user.id);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    businessId: user.businessId,
    shopId: user.shopId,
    passwordVersion: user.passwordVersion,
    status: user.status,
  } as AuthUser;
}

export function buildLoginResponse(user: AuthUser) {
  const token = createSessionToken({ userId: user.id, passwordVersion: user.passwordVersion });
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export function buildLogoutResponse() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    path: "/",
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;

  const session = verifySessionToken(cookie);
  if (!session) return null;

  const { data: user, error } = await svc
    .from("\"User\"")
    .select("id,name,email,role,businessId,shopId,status,passwordVersion")
    .eq("id", session.userId)
    .maybeSingle();

  if (error || !user || user.status !== "ACTIVE" || user.passwordVersion !== session.passwordVersion) {
    return null;
  }

  const result: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    businessId: user.businessId,
    shopId: user.shopId,
    passwordVersion: user.passwordVersion,
    status: user.status,
  };

  if (user.role === "SHOP") {
    if (!user.shopId) return null;
    const { data: shop, error: shopError } = await svc
      .from("\"Shop\"")
      .select("id,name,code,isActive")
      .eq("id", user.shopId)
      .maybeSingle();
    if (shopError || !shop || !shop.isActive) return null;
    result.shop = shop;
  }

  return result;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/unauthorized");
  return user;
}

export async function requireShop() {
  const user = await requireUser();
  if (user.role !== "SHOP" || !user.shopId || !user.shop) redirect("/unauthorized");
  return user as typeof user & {
    role: "SHOP";
    shopId: string;
    shop: { id: string; name: string; code: string; isActive: boolean };
  };
}

export async function verifyServerSession() {
  return await getCurrentUser();
}
