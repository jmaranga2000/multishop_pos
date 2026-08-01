import { endOfDay, startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { queueNotification } from "@/lib/notifications/service";
import { writeAuditLog } from "@/services/shared/audit-service";
import type { z } from "zod";
import type { createRefundRequestSchema } from "@/validators/shop/refund-validator";

type CreateRefundRequestInput = z.infer<typeof createRefundRequestSchema>;
type ShopContext = { id: string; shopId: string; businessId: string };

type RefundSaleSearchQuery = {
  receiptNumber?: string;
  saleReference?: string;
  customerName?: string;
  saleDate?: string;
};

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

export async function searchShopSalesForRefunds(shopId: string, query: RefundSaleSearchQuery) {
  const where: Record<string, unknown> = { shopId, status: "COMPLETED" };
  const filters: Record<string, unknown>[] = [];

  if (query.receiptNumber?.trim()) {
    filters.push({ receiptNumber: { contains: query.receiptNumber.trim() } });
  }
  if (query.saleReference?.trim()) {
    filters.push({ clientReference: { contains: query.saleReference.trim() } });
  }
  if (query.customerName?.trim()) {
    filters.push({ customerName: { contains: query.customerName.trim() } });
  }
  if (query.saleDate) {
    const saleDate = new Date(query.saleDate);
    if (!Number.isNaN(saleDate.getTime())) {
      filters.push({ occurredAt: { gte: startOfDay(saleDate), lte: endOfDay(saleDate) } });
    }
  }

  if (filters.length) {
    Object.assign(where, { OR: filters });
  }

  return db.sale.findMany({
    where,
    include: { items: { include: { product: true } } },
    orderBy: { occurredAt: "desc" },
    take: 20,
  });
}

export async function createShopRefundRequest(shopUser: ShopContext, input: CreateRefundRequestInput) {
  const sale = await db.sale.findFirst({
    where: input.saleId
      ? { id: input.saleId, shopId: shopUser.shopId, status: "COMPLETED" }
      : { receiptNumber: input.receiptNumber, shopId: shopUser.shopId, status: "COMPLETED" },
    include: { items: { include: { product: true } } },
  });
  if (!sale) throw new AppError("A completed sale with that receipt number was not found.");
  const existing = await db.refundRequest.findFirst({ where: { saleId: sale.id, status: { in: ["PENDING", "APPROVED", "COMPLETED"] } } });
  if (existing) throw new AppError("A refund request already exists for this sale.");

  const selectedItems = input.requestType === "SELECTED_PRODUCTS"
    ? sale.items.filter((item: { id: string }) => input.selectedItemIds.includes(item.id))
    : sale.items;

  if (input.requestType === "SELECTED_PRODUCTS" && selectedItems.length === 0) {
    throw new AppError("Select at least one item from the completed sale.");
  }

  return db.$transaction(async (tx) => {
    const request = await tx.refundRequest.create({
      data: {
        saleId: sale.id,
        shopId: shopUser.shopId,
        reason: input.reason,
        requestType: input.requestType,
        refundMethod: input.refundMethod,
        selectedItemIds: input.selectedItemIds,
        restockReturnedProducts: input.restockReturnedProducts,
        markItemsAsDamaged: input.markItemsAsDamaged,
        requestManagerApproval: input.requestManagerApproval,
      },
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
          message: `Refund requested for receipt ${sale.receiptNumber} via ${input.requestType}.`,
          actionUrl: "/admin/refunds",
        },
      });
      await queueNotification({
        tx,
        businessId: shopUser.businessId,
        userId: admin.id,
        shopId: shopUser.shopId,
        type: "REFUND_REQUEST",
        priority: "URGENT",
        title: `Refund requested for ${sale.receiptNumber}`,
        message: `A shop requested a refund for receipt ${sale.receiptNumber}. Tap to review.`,
        actionUrl: "/admin/refunds",
        push: true,
        inApp: false,
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
