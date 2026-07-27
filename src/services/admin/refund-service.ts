import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors/app-error";
import { createDocumentNumber } from "@/lib/ids/document-number";
import { reconcileStockAlert } from "@/lib/stock-alerts";
import { writeAuditLog } from "@/services/shared/audit-service";
import type { z } from "zod";
import type { reviewRefundSchema } from "@/validators/admin/review-validator";

type ReviewRefundInput = z.infer<typeof reviewRefundSchema>;
type AdminContext = { id: string; email: string; businessId: string };

export async function getAdminRefundPageData(businessId: string) {
  const [business, requests] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId } }),
    prisma.refundRequest.findMany({
      where: { shop: { businessId } },
      include: { shop: true, sale: { include: { items: true } } },
      orderBy: { requestedAt: "desc" },
      take: 100,
    }),
  ]);
  return { business, requests };
}

export async function reviewRefundRequest(admin: AdminContext, input: ReviewRefundInput) {
  const request = await prisma.refundRequest.findFirst({
    where: { id: input.refundRequestId, shop: { businessId: admin.businessId } },
    include: { shop: true, sale: { include: { items: { include: { product: true } }, refunds: true } } },
  });
  if (!request) throw new AppError("Refund request was not found.", "REFUND_NOT_FOUND", 404);
  if (request.status !== "PENDING") throw new AppError("This refund request has already been reviewed.");

  if (input.decision === "REJECTED") {
    const rejected = await prisma.refundRequest.update({
      where: { id: request.id },
      data: { status: "REJECTED", reviewedAt: new Date(), reviewNote: input.reviewNote || null },
    });
    await writeAuditLog(prisma, {
      userId: admin.id,
      shopId: request.shopId,
      action: "REFUND_REJECTED",
      entityType: "REFUND_REQUEST",
      entityId: request.id,
      description: `Rejected refund request for ${request.sale.receiptNumber}.`,
    });
    return rejected;
  }

  if (request.sale.refunds.length > 0) throw new AppError("This sale already has a completed refund.");

  return prisma.$transaction(async (tx) => {
    const refund = await tx.refund.create({
      data: {
        saleId: request.saleId,
        refundNumber: createDocumentNumber("RFN", request.shop.code),
        total: request.sale.total,
        reason: request.reason,
        items: {
          create: request.sale.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            amount: item.lineTotal,
            restock: true,
          })),
        },
      },
    });

    for (const item of request.sale.items) {
      const inventory = await tx.shopInventory.findUnique({
        where: { shopId_productId: { shopId: request.shopId, productId: item.productId } },
      });
      if (!inventory) continue;
      const updated = await tx.shopInventory.update({
        where: { id: inventory.id },
        data: { quantity: { increment: item.quantity }, isAvailable: true, version: { increment: 1 } },
      });
      await tx.stockMovement.create({
        data: {
          shopId: request.shopId,
          productId: item.productId,
          type: "CUSTOMER_RETURN",
          quantityChange: item.quantity,
          quantityBefore: inventory.quantity,
          quantityAfter: updated.quantity,
          referenceType: "REFUND",
          referenceId: refund.id,
          note: request.reason,
        },
      });
      await reconcileStockAlert(tx, {
        businessId: admin.businessId,
        shopId: request.shopId,
        shopName: request.shop.name,
        productId: item.productId,
        productName: item.product.name,
        quantity: updated.quantity,
        reorderLevel: updated.reorderLevel,
        criticalLevel: updated.criticalLevel,
        adminId: admin.id,
        adminEmail: admin.email,
      });
    }

    await tx.sale.update({ where: { id: request.saleId }, data: { status: "REFUNDED" } });
    const completed = await tx.refundRequest.update({
      where: { id: request.id },
      data: { status: "COMPLETED", reviewedAt: new Date(), reviewNote: input.reviewNote || null },
    });
    await writeAuditLog(tx, {
      userId: admin.id,
      shopId: request.shopId,
      action: "REFUND_COMPLETED",
      entityType: "REFUND",
      entityId: refund.id,
      description: `Completed refund for ${request.sale.receiptNumber}.`,
    });
    return completed;
  });
}
