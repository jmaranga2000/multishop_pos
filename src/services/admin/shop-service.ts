import argon2 from "argon2";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { writeAuditLog } from "@/services/shared/audit-service";
import type { z } from "zod";
import type { createShopSchema, resetShopPasswordSchema, toggleShopSchema, updateShopSchema } from "@/validators/admin/shop-validator";

type CreateShopInput = z.infer<typeof createShopSchema>;
type ResetShopPasswordInput = z.infer<typeof resetShopPasswordSchema>;
type ToggleShopInput = z.infer<typeof toggleShopSchema>;
type UpdateShopInput = z.infer<typeof updateShopSchema>;

export async function listAdminShops(businessId: string) {
  return db.shop.findMany({
    where: { businessId },
    include: { account: { select: { id: true, email: true, status: true } }, _count: { select: { inventory: true, sales: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getAdminShopById(businessId: string, shopId: string) {
  return db.shop.findFirst({
    where: { id: shopId, businessId },
    include: {
      account: { select: { id: true, email: true, status: true } },
      _count: { select: { inventory: true, sales: true } },
      registers: true,
    },
  });
}

export async function createShopWithAccount(admin: { id: string; businessId: string }, input: CreateShopInput) {
  const passwordHash = await argon2.hash(input.password);
  async function generateCodeCandidate(name: string) {
    const prefix = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const base = prefix.length ? `${prefix}-${suffix}` : `SHP-${suffix}`;
    return base.slice(0, 30);
  }

  async function generateUniqueShopCode(name: string) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const candidate = await generateCodeCandidate(name);
      const existing = await db.shop.findFirst({ where: { businessId: admin.businessId, code: candidate } });
      if (!existing) return candidate;
    }
    // fallback
    return `${(await generateCodeCandidate(name)).slice(0, 26)}-${Math.floor(Math.random() * 9000 + 1000)}`.slice(0, 30);
  }
  return db.$transaction(async (tx) => {
    const codeToUse = input.code ?? (await generateUniqueShopCode(input.name));

    const shop = await tx.shop.create({
      data: {
        businessId: admin.businessId,
        name: input.name,
        code: codeToUse,
        email: input.email,
        phone: input.phone || null,
        address: input.address || null,
      },
    });
    const account = await tx.user.create({
      data: {
        businessId: admin.businessId,
        shopId: shop.id,
        name: `${input.name} account`,
        email: input.email,
        passwordHash,
        role: "SHOP",
        createdById: admin.id,
      },
    });
    await tx.register.create({ data: { shopId: shop.id, name: "Main counter", code: "MAIN" } });
    await writeAuditLog(tx, {
      userId: admin.id,
      shopId: shop.id,
      action: "SHOP_CREATED",
      entityType: "SHOP",
      entityId: shop.id,
      description: `Created ${shop.name} and its shop login account.`,
    });
    return { shop, accountId: account.id };
  });
}

export async function resetShopPassword(admin: { id: string; businessId: string }, input: ResetShopPasswordInput) {
  const account = await db.user.findFirst({ where: { id: input.userId, businessId: admin.businessId, role: "SHOP" } });
  if (!account) throw new AppError("Shop account was not found.", "SHOP_ACCOUNT_NOT_FOUND", 404);
  const passwordHash = await argon2.hash(input.password);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: account.id },
      data: { passwordHash, passwordVersion: { increment: 1 }, failedLoginAttempts: 0, lockedUntil: null },
    });
    await writeAuditLog(tx, {
      userId: admin.id,
      shopId: account.shopId,
      action: "SHOP_PASSWORD_RESET",
      entityType: "USER",
      entityId: account.id,
      description: `Reset password for ${account.email}.`,
    });
  });
}

export async function setShopActiveState(admin: { id: string; businessId: string }, input: ToggleShopInput) {
  const shop = await db.shop.findFirst({ where: { id: input.shopId, businessId: admin.businessId }, include: { account: true } });
  if (!shop) throw new AppError("Shop was not found.", "SHOP_NOT_FOUND", 404);
  const active = input.isActive === "true";
  await db.$transaction(async (tx) => {
    await tx.shop.update({ where: { id: shop.id }, data: { isActive: active } });
    if (shop.account) {
      await tx.user.update({
        where: { id: shop.account.id },
        data: { status: active ? "ACTIVE" : "SUSPENDED", passwordVersion: { increment: active ? 0 : 1 } },
      });
    }
    await writeAuditLog(tx, {
      userId: admin.id,
      shopId: shop.id,
      action: active ? "SHOP_ACTIVATED" : "SHOP_SUSPENDED",
      entityType: "SHOP",
      entityId: shop.id,
      description: `${active ? "Activated" : "Suspended"} ${shop.name}.`,
    });
  });
}

export async function updateShopAndAccount(admin: { id: string; businessId: string }, input: UpdateShopInput) {
  const shop = await db.shop.findFirst({ where: { id: input.shopId, businessId: admin.businessId }, include: { account: true } });
  if (!shop) throw new AppError("Shop was not found.", "SHOP_NOT_FOUND", 404);

  const activateShop = Boolean(input.password);

  await db.$transaction(async (tx) => {
    await tx.shop.update({
      where: { id: shop.id },
      data: {
        name: input.name,
        code: input.code,
        email: input.email ?? shop.email,
        phone: input.phone || null,
        address: input.address || null,
        isActive: activateShop || shop.isActive,
      },
    });

    if (shop.account) {
      const accountUpdates: Record<string, unknown> = {};
      if (input.email && input.email !== shop.account.email) {
        accountUpdates.email = input.email;
      }
      if (activateShop && input.password) {
        accountUpdates.passwordHash = await argon2.hash(input.password);
        accountUpdates.passwordVersion = { increment: 1 };
        accountUpdates.failedLoginAttempts = 0;
        accountUpdates.lockedUntil = null;
        accountUpdates.status = "ACTIVE";
      }
      if (Object.keys(accountUpdates).length > 0) {
        await tx.user.update({ where: { id: shop.account.id }, data: accountUpdates });
      }
    } else if (input.email && activateShop && input.password) {
      const passwordHash = await argon2.hash(input.password);
      await tx.user.create({
        data: {
          businessId: admin.businessId,
          shopId: shop.id,
          name: `${input.name} account`,
          email: input.email,
          passwordHash,
          role: "SHOP",
          status: "ACTIVE",
          createdById: admin.id,
        },
      });
    }

    await writeAuditLog(tx, {
      userId: admin.id,
      shopId: shop.id,
      action: "SHOP_UPDATED",
      entityType: "SHOP",
      entityId: shop.id,
      description: `Updated ${input.name} (${shop.id}).`,
    });
  });
}
