import argon2 from "argon2";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { writeAuditLog } from "@/services/shared/audit-service";
import type { z } from "zod";
import type { openRegisterSchema, closeRegisterSchema } from "@/validators/shop/register-validator";

type OpenRegisterInput = z.infer<typeof openRegisterSchema>;
type CloseRegisterInput = z.infer<typeof closeRegisterSchema>;

type ShopContext = { id: string; shopId: string; businessId: string };

export async function getShopRegisterData(shopId: string, businessId: string) {
  const [business, registers, salespeople, openSession, recentSessions] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.register.findMany({ where: { shopId, isActive: true }, orderBy: { name: "asc" } }),
    db.salespersonProfile.findMany({ where: { shopId, isActive: true }, orderBy: { name: "asc" } }),
    db.registerSession.findFirst({
      where: { shopId, status: "OPEN" },
      include: { register: true, salesperson: true },
      orderBy: { openedAt: "desc" },
    }),
    db.registerSession.findMany({
      where: { shopId },
      include: { register: true, salesperson: true, _count: { select: { sales: true } } },
      orderBy: { openedAt: "desc" },
      take: 20,
    }),
  ]);
  return { business, registers, salespeople, openSession, recentSessions };
}

export async function openRegisterSession(shopUser: ShopContext, input: OpenRegisterInput) {
  const existing = await db.registerSession.findFirst({ where: { shopId: shopUser.shopId, status: "OPEN" } });
  if (existing) throw new AppError("This shop already has an open register session.");

  const register = await db.register.findFirst({ where: { id: input.registerId, shopId: shopUser.shopId, isActive: true } });
  if (!register) throw new AppError("Register was not found.");

  let salespersonId: string | null = null;
  if (input.salespersonId) {
    const salesperson = await db.salespersonProfile.findFirst({
      where: { id: input.salespersonId, shopId: shopUser.shopId, isActive: true },
    });
    if (!salesperson) throw new AppError("Salesperson profile was not found.");
    if (!input.pin || !(await argon2.verify(salesperson.pinHash, input.pin))) throw new AppError("The salesperson PIN is incorrect.");
    salespersonId = salesperson.id;
  }

  const session = await db.registerSession.create({
    data: {
      shopId: shopUser.shopId,
      registerId: register.id,
      salespersonId,
      openingCash: input.openingCash,
      openingNote: input.openingNote || null,
    },
  });
  await writeAuditLog(db, {
    userId: shopUser.id,
    shopId: shopUser.shopId,
    action: "REGISTER_OPENED",
    entityType: "REGISTER_SESSION",
    entityId: session.id,
    description: `Opened ${register.name} with opening cash ${input.openingCash}.`,
  });
  return session;
}

export async function closeRegisterSession(shopUser: ShopContext, input: CloseRegisterInput) {
  const session = await db.registerSession.findFirst({
    where: { id: input.sessionId, shopId: shopUser.shopId, status: "OPEN" },
    include: { register: true },
  });
  if (!session) throw new AppError("Open register session was not found.");

  const [cashPayments, cashMovements] = await Promise.all([
    db.payment.aggregate({
      where: { sale: { registerSessionId: session.id, status: "COMPLETED" }, method: "CASH", status: "VERIFIED" },
      _sum: { amount: true },
    }),
    db.registerTransaction.findMany({ where: { registerSessionId: session.id } }),
  ]);
  const cashSales = Number(cashPayments._sum.amount ?? 0);
  const movementTotal = cashMovements.reduce((sum, movement) => {
    const amount = Number(movement.amount);
    return movement.type === "CASH_OUT" ? sum - amount : movement.type === "CASH_IN" ? sum + amount : sum;
  }, 0);
  const expectedCash = Number(session.openingCash) + cashSales + movementTotal;
  const variance = input.actualCash - expectedCash;

  const closed = await db.$transaction(async (tx) => {
    const updated = await tx.registerSession.update({
      where: { id: session.id },
      data: {
        status: "CLOSED",
        expectedCash,
        actualCash: input.actualCash,
        variance,
        closingNote: input.closingNote || null,
        closedAt: new Date(),
      },
    });
    if (variance !== 0) {
      const admin = await tx.user.findFirst({ where: { businessId: shopUser.businessId, role: "ADMIN", status: "ACTIVE" } });
      if (admin) {
        await tx.notification.create({
          data: {
            userId: admin.id,
            shopId: shopUser.shopId,
            type: "REGISTER_DISCREPANCY",
            priority: Math.abs(variance) > 1000 ? "HIGH" : "NORMAL",
            title: "Register discrepancy",
            message: `${session.register.name} closed with a variance of ${variance.toFixed(2)}.`,
            actionUrl: "/admin/registers",
          },
        });
      }
    }
    await writeAuditLog(tx, {
      userId: shopUser.id,
      shopId: shopUser.shopId,
      action: "REGISTER_CLOSED",
      entityType: "REGISTER_SESSION",
      entityId: session.id,
      description: `Closed ${session.register.name} with variance ${variance.toFixed(2)}.`,
      metadata: { expectedCash, actualCash: input.actualCash, variance },
    });
    return updated;
  });
  return closed;
}
