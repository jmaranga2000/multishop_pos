import argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors/app-error";
import { writeAuditLog } from "@/services/shared/audit-service";
import type { z } from "zod";
import type { createShopSchema, resetShopPasswordSchema, toggleShopSchema } from "@/validators/admin/shop-validator";

type CreateShopInput = z.infer<typeof createShopSchema>;
type ResetShopPasswordInput = z.infer<typeof resetShopPasswordSchema>;
type ToggleShopInput = z.infer<typeof toggleShopSchema>;

export async function listAdminShops(businessId: string) {
  return prisma.shop.findMany({
    where: { businessId },
    include: { account: { select: { id: true, email: true, status: true } }, _count: { select: { inventory: true, sales: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createShopWithAccount(admin: { id: string; businessId: string }, input: CreateShopInput) {
  const passwordHash = await argon2.hash(input.password);
  return prisma.$transaction(async (tx) => {
    const shop = await tx.shop.create({
      data: {
        businessId: admin.businessId,
        name: input.name,
        code: input.code,
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
  const account = await prisma.user.findFirst({ where: { id: input.userId, businessId: admin.businessId, role: "SHOP" } });
  if (!account) throw new AppError("Shop account was not found.", "SHOP_ACCOUNT_NOT_FOUND", 404);
  const passwordHash = await argon2.hash(input.password);
  await prisma.$transaction(async (tx) => {
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
  const shop = await prisma.shop.findFirst({ where: { id: input.shopId, businessId: admin.businessId }, include: { account: true } });
  if (!shop) throw new AppError("Shop was not found.", "SHOP_NOT_FOUND", 404);
  const active = input.isActive === "true";
  await prisma.$transaction(async (tx) => {
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
