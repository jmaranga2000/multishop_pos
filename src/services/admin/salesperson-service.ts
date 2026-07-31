import argon2 from "argon2";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { writeAuditLog } from "@/services/shared/audit-service";
import type { z } from "zod";
import type { createSalespersonSchema, toggleSalespersonSchema, updateSalespersonSchema } from "@/validators/admin/salesperson-validator";

type CreateSalespersonInput = z.infer<typeof createSalespersonSchema>;
type ToggleSalespersonInput = z.infer<typeof toggleSalespersonSchema>;
type UpdateSalespersonInput = z.infer<typeof updateSalespersonSchema>;

export async function getSalespersonManagementData(businessId: string) {
  const [shops, salespeople] = await Promise.all([
    db.shop.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } }),
    db.salespersonProfile.findMany({
      where: { shop: { businessId } },
      include: { shop: true, _count: { select: { sales: true, sessions: true } } },
      orderBy: [{ shop: { name: "asc" } }, { name: "asc" }],
    }),
  ]);
  return { shops, salespeople };
}

export async function getAdminSalespersonById(businessId: string, id: string) {
  return db.salespersonProfile.findFirst({
    where: { id, shop: { businessId } },
    include: { shop: true, _count: { select: { sales: true, sessions: true } } },
  });
}

export async function createSalesperson(admin: { id: string; businessId: string }, input: CreateSalespersonInput) {
  const shop = await db.shop.findFirst({ where: { id: input.shopId, businessId: admin.businessId } });
  if (!shop) throw new AppError("Shop was not found.");
  const profile = await db.salespersonProfile.create({
    data: { shopId: shop.id, name: input.name, code: input.code, pinHash: await argon2.hash(input.pin) },
  });
  await writeAuditLog(db, {
    userId: admin.id,
    shopId: shop.id,
    action: "SALESPERSON_CREATED",
    entityType: "SALESPERSON_PROFILE",
    entityId: profile.id,
    description: `Created salesperson ${profile.name} for ${shop.name}.`,
  });
  return profile;
}

export async function updateSalesperson(admin: { id: string; businessId: string }, input: UpdateSalespersonInput) {
  const profile = await db.salespersonProfile.findFirst({
    where: { id: input.salespersonId, shop: { businessId: admin.businessId } },
    include: { shop: true },
  });
  if (!profile) throw new AppError("Salesperson profile was not found.");

  const updated = await db.salespersonProfile.update({
    where: { id: profile.id },
    data: {
      name: input.name,
      code: input.code,
    },
  });

  await writeAuditLog(db, {
    userId: admin.id,
    shopId: profile.shopId,
    action: "SALESPERSON_UPDATED",
    entityType: "SALESPERSON_PROFILE",
    entityId: updated.id,
    description: `Updated salesperson ${updated.name}.`,
  });

  return updated;
}

export async function setSalespersonActiveState(admin: { id: string; businessId: string }, input: ToggleSalespersonInput) {
  const profile = await db.salespersonProfile.findFirst({
    where: { id: input.salespersonId, shop: { businessId: admin.businessId } },
    include: { shop: true },
  });
  if (!profile) throw new AppError("Salesperson profile was not found.");
  const isActive = input.isActive === "true";
  await db.salespersonProfile.update({ where: { id: profile.id }, data: { isActive } });
  await writeAuditLog(db, {
    userId: admin.id,
    shopId: profile.shopId,
    action: isActive ? "SALESPERSON_ACTIVATED" : "SALESPERSON_DEACTIVATED",
    entityType: "SALESPERSON_PROFILE",
    entityId: profile.id,
    description: `${isActive ? "Activated" : "Deactivated"} ${profile.name}.`,
  });
}
