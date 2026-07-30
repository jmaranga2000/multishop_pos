import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { writeAuditLog } from "@/services/shared/audit-service";
import type { z } from "zod";
import type { createRefundRequestSchema } from "@/validators/shop/refund-validator";

type CreateRefundRequestInput = z.infer<typeof createRefundRequestSchema>;
type ShopContext = { id: string; shopId: string; businessId: string };

export async function getShopRefundPageData(shopId: string, businessId: string) {
  const [business, requests] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.refundRequest.findMany({
      where: { shopId },
      include: { sale: { select: { receiptNumber: true, total: true, occurredAt: true } } },
      orderBy: { requestedAt: "desc" },
      take: 100,
    }),
  ]);
  return { business, requests };
}

export async function createShopRefundRequest(shopUser: ShopContext, input: CreateRefundRequestInput) {
  const sale = await db.sale.findFirst({
    where: { receiptNumber: input.receiptNumber, shopId: shopUser.shopId, status: "COMPLETED" },
  });
  if (!sale) throw new AppError("A completed sale with that receipt number was not found.");
  const existing = await db.refundRequest.findFirst({ where: { saleId: sale.id, status: { in: ["PENDING", "APPROVED", "COMPLETED"] } } });
  if (existing) throw new AppError("A refund request already exists for this sale.");

  return db.$transaction(async (tx) => {
    const request = await tx.refundRequest.create({
      data: { saleId: sale.id, shopId: shopUser.shopId, reason: input.reason },
    });
    const admin = await tx.user.findFirst({ where: { businessId: shopUser.businessId, role: "ADMIN", status: "ACTIVE" } });
    if (admin) {
      await tx.notification.create({
        data: {
          userId: admin.id,
          shopId: shopUser.shopId,
          type: "REFUND_REQUEST",
          priority: "HIGH",
          title: "Refund request",
          message: `Refund requested for receipt ${sale.receiptNumber}.`,
          actionUrl: "/admin/refunds",
        },
      });
    }
    await writeAuditLog(tx, {
      userId: shopUser.id,
      shopId: shopUser.shopId,
      action: "REFUND_REQUESTED",
      entityType: "REFUND_REQUEST",
      entityId: request.id,
      description: `Requested a refund for ${sale.receiptNumber}.`,
    });
    return request;
  });
}
