import { randomUUID } from "node:crypto";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { createDocumentNumber } from "@/lib/ids/document-number";
import { queueNotification } from "@/lib/notifications/service";
import { reconcileStockAlert } from "@/lib/stock-alerts";
import { writeAuditLog } from "@/services/shared/audit-service";
import { PurchaseOrderPdf } from "@/lib/reports/purchase-order-pdf";
import type { z } from "zod";
import type {
  createPurchaseOrderSchema,
  createRequisitionSchema,
  purchaseOrderIdSchema,
  receiveGoodsSchema,
  requisitionDecisionSchema,
  supplierPaymentSchema,
} from "@/validators/procurement/procurement-validator";

type AdminContext = { id: string; email: string; businessId: string };
type ShopContext = { id: string; email: string; businessId: string; shopId: string; shop: { id: string; name: string; code: string } };
type ProcurementActor = Pick<AdminContext, "id" | "businessId"> & Partial<Pick<AdminContext, "email">> & { shopId?: string | null };
type CreateRequisitionInput = z.infer<typeof createRequisitionSchema>;
type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
type ReceiveGoodsInput = z.infer<typeof receiveGoodsSchema>;
type SupplierPaymentInput = z.infer<typeof supplierPaymentSchema>;
type DecisionInput = z.infer<typeof requisitionDecisionSchema>;

type ApprovalAction = "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED" | "CONVERTED" | "SENT" | "RECEIVED" | "COMPLETED";

const activeOrderStatuses = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "PARTIALLY_RECEIVED"] as const;

function history(action: ApprovalAction, userId: string, note?: string | null) {
  return { action, userId, occurredAt: new Date(), note: note || null };
}

function appendHistory(existing: Array<unknown> | null | undefined, entry: ReturnType<typeof history>) {
  return [...(existing ?? []), entry];
}

function statusTone(status: string) {
  return status.replaceAll("_", " ").toLowerCase();
}

function supplierOrderEmail(input: { supplierName: string; shopName: string; orderNumber: string; items: Array<{ productName: string; quantity: number; unitName?: string | null; unitCost: number; lineTotal: number }>; total: number; notes?: string | null }) {
  const rows = input.items.map((item) => `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(item.productName)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${item.quantity} ${escapeHtml(item.unitName || "units")}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">KES ${item.unitCost.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">KES ${item.lineTotal.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</td></tr>`).join("");
  return `<div style="font-family:Arial,sans-serif;color:#0f172a"><h1>Purchase order ${escapeHtml(input.orderNumber)}</h1><p>Hello ${escapeHtml(input.supplierName)},</p><p>${escapeHtml(input.shopName)} has issued the purchase order below.</p><table style="width:100%;border-collapse:collapse"><thead><tr><th align="left" style="padding:8px">Product</th><th align="left" style="padding:8px">Quantity</th><th align="left" style="padding:8px">Unit cost</th><th align="left" style="padding:8px">Total</th></tr></thead><tbody>${rows}</tbody></table><p style="font-weight:700">Order total: KES ${input.total.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</p>${input.notes ? `<p>Notes: ${escapeHtml(input.notes)}</p>` : ""}<p>Please confirm availability and the expected delivery date.</p></div>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character] ?? character));
}

export async function getProcurementManagementData(businessId: string, filters?: { shopId?: string; supplierId?: string; status?: string }) {
  const orderWhere = {
    businessId,
    ...(filters?.shopId ? { shopId: filters.shopId } : {}),
    ...(filters?.supplierId ? { supplierId: filters.supplierId } : {}),
    ...(filters?.status ? { status: filters.status } : {}),
  };
  const [shops, suppliers, products, requisitions, purchaseOrders, goodsReceivedNotes, payables] = await Promise.all([
    db.shop.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } }),
    db.supplier.findMany({ where: { businessId, status: "ACTIVE" }, include: { shop: true, supplierProducts: { include: { product: true } } }, orderBy: { name: "asc" } }),
    db.product.findMany({ where: { businessId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    db.purchaseRequisition.findMany({ where: { businessId, ...(filters?.shopId ? { shopId: filters.shopId } : {}) }, include: { shop: true, supplier: true, items: { include: { product: true } } }, orderBy: { createdAt: "desc" }, take: 150 }),
    db.purchaseOrder.findMany({ where: orderWhere, include: { shop: true, supplier: true, items: { include: { product: true } }, requisition: true }, orderBy: { createdAt: "desc" }, take: 150 }),
    db.goodsReceivedNote.findMany({ where: { businessId, ...(filters?.shopId ? { shopId: filters.shopId } : {}) }, include: { shop: true, supplier: true, purchaseOrder: true, items: { include: { product: true } }, payable: true }, orderBy: { receivedAt: "desc" }, take: 150 }),
    db.supplierPayable.findMany({ where: { businessId, ...(filters?.shopId ? { shopId: filters.shopId } : {}) }, include: { shop: true, supplier: true, purchaseOrder: true, goodsReceivedNote: true, payments: true }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200 }),
  ]);
  return { shops, suppliers, products, requisitions, purchaseOrders, goodsReceivedNotes, payables };
}

export async function getShopProcurementData(shop: Pick<ShopContext, "businessId" | "shopId">) {
  const [suppliers, inventory, requisitions, purchaseOrders, goodsReceivedNotes] = await Promise.all([
    db.supplier.findMany({ where: { businessId: shop.businessId, shopId: shop.shopId, status: "ACTIVE" }, include: { supplierProducts: { include: { product: true } } }, orderBy: { name: "asc" } }),
    db.shopInventory.findMany({ where: { shopId: shop.shopId }, include: { product: { include: { unit: true } } }, orderBy: { product: { name: "asc" } } }),
    db.purchaseRequisition.findMany({ where: { businessId: shop.businessId, shopId: shop.shopId }, include: { supplier: true, items: { include: { product: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.purchaseOrder.findMany({ where: { businessId: shop.businessId, shopId: shop.shopId }, include: { supplier: true, items: { include: { product: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.goodsReceivedNote.findMany({ where: { businessId: shop.businessId, shopId: shop.shopId }, include: { supplier: true, purchaseOrder: true, items: { include: { product: true } } }, orderBy: { receivedAt: "desc" }, take: 100 }),
  ]);
  return { suppliers, inventory, requisitions, purchaseOrders, goodsReceivedNotes };
}

export async function createPurchaseRequisition(actor: ProcurementActor, input: CreateRequisitionInput) {
  if (actor.shopId) {
    const shop = await db.shop.findFirst({ where: { id: actor.shopId, businessId: actor.businessId, isActive: true } });
    if (!shop) throw new AppError("The active shop is unavailable.", "SHOP_NOT_FOUND", 404);
  }
  const shopId = actor.shopId;
  if (!shopId) throw new AppError("Select a shop before creating a requisition.");
  const [shop, supplier, products, inventory] = await Promise.all([
    db.shop.findFirst({ where: { id: shopId, businessId: actor.businessId, isActive: true } }),
    input.supplierId ? db.supplier.findFirst({ where: { id: input.supplierId, businessId: actor.businessId, shopId, status: "ACTIVE" } }) : null,
    db.product.findMany({ where: { businessId: actor.businessId, id: { in: input.items.map((item) => item.productId) }, status: "ACTIVE" }, include: { unit: true } }),
    db.shopInventory.findMany({ where: { shopId, productId: { in: input.items.map((item) => item.productId) } } }),
  ]);
  if (!shop) throw new AppError("Shop not found.", "SHOP_NOT_FOUND", 404);
  if (input.supplierId && !supplier) throw new AppError("Supplier is not assigned to this shop.", "SUPPLIER_NOT_FOUND", 404);
  if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) throw new AppError("Add each product only once to a requisition.");
  if (products.length !== input.items.length) throw new AppError("One or more selected products are unavailable.", "PRODUCT_NOT_FOUND", 404);

  const productById = new Map(products.map((product) => [product.id, product]));
  const inventoryByProductId = new Map(inventory.map((item) => [item.productId, item]));
  return db.$transaction(async (tx) => {
    const requisition = await tx.purchaseRequisition.create({
      data: {
        businessId: actor.businessId,
        shopId,
        supplierId: supplier?.id ?? null,
        requisitionNumber: createDocumentNumber("REQ", shop.code),
        status: "SUBMITTED",
        requestedById: actor.id,
        reason: input.reason ?? null,
        notes: input.notes ?? null,
        submittedAt: new Date(),
        approvalHistory: [history("SUBMITTED", actor.id, input.reason)],
        items: { create: input.items.map((item) => {
          const product = productById.get(item.productId)!;
          const itemInventory = inventoryByProductId.get(item.productId);
          return {
            productId: product.id,
            unitId: item.unitId ?? product.unitId ?? null,
            productName: product.name,
            unitName: product.unit?.name ?? null,
            unitSymbol: product.unit?.symbol ?? null,
            currentQuantity: itemInventory?.quantity ?? 0,
            restockThreshold: itemInventory?.reorderLevel ?? 0,
            requestedQuantity: item.requestedQuantity,
            notes: item.notes ?? null,
          };
        }) },
      },
      include: { items: true },
    });
    await writeAuditLog(tx, {
      userId: actor.id, shopId, action: "PURCHASE_REQUISITION_SUBMITTED", entityType: "PURCHASE_REQUISITION", entityId: requisition.id,
      description: `Submitted requisition ${requisition.requisitionNumber} with ${input.items.length} item${input.items.length === 1 ? "" : "s"}.`,
      metadata: { supplierId: supplier?.id ?? null, reason: input.reason ?? null },
    });
    return requisition;
  });
}

export async function approvePurchaseRequisition(admin: AdminContext, input: DecisionInput) {
  const requisition = await db.purchaseRequisition.findFirst({ where: { id: input.requisitionId, businessId: admin.businessId }, include: { shop: true } });
  if (!requisition) throw new AppError("Requisition not found.", "REQUISITION_NOT_FOUND", 404);
  if (requisition.status !== "SUBMITTED") throw new AppError("Only submitted requisitions can be approved.");
  const updated = await db.purchaseRequisition.update({ where: { id: requisition.id }, data: {
    status: "APPROVED", approvedById: admin.id, approvedAt: new Date(), approvalHistory: appendHistory(requisition.approvalHistory, history("APPROVED", admin.id, input.note)),
  } });
  await writeAuditLog(db, { userId: admin.id, shopId: requisition.shopId, action: "PURCHASE_REQUISITION_APPROVED", entityType: "PURCHASE_REQUISITION", entityId: requisition.id, description: `Approved requisition ${requisition.requisitionNumber}.`, metadata: { note: input.note ?? null } });
  return updated;
}

export async function rejectPurchaseRequisition(admin: AdminContext, input: DecisionInput) {
  const requisition = await db.purchaseRequisition.findFirst({ where: { id: input.requisitionId, businessId: admin.businessId } });
  if (!requisition) throw new AppError("Requisition not found.", "REQUISITION_NOT_FOUND", 404);
  if (requisition.status !== "SUBMITTED") throw new AppError("Only submitted requisitions can be rejected.");
  if (!input.note) throw new AppError("Give a reason when rejecting a requisition.");
  const updated = await db.purchaseRequisition.update({ where: { id: requisition.id }, data: {
    status: "REJECTED", rejectedById: admin.id, rejectedAt: new Date(), rejectionReason: input.note, approvalHistory: appendHistory(requisition.approvalHistory, history("REJECTED", admin.id, input.note)),
  } });
  await writeAuditLog(db, { userId: admin.id, shopId: requisition.shopId, action: "PURCHASE_REQUISITION_REJECTED", entityType: "PURCHASE_REQUISITION", entityId: requisition.id, description: `Rejected requisition ${requisition.requisitionNumber}.`, metadata: { reason: input.note } });
  return updated;
}

export async function createPurchaseOrder(admin: AdminContext, input: CreatePurchaseOrderInput) {
  if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) throw new AppError("Add each product only once to a purchase order.");
  const [shop, supplier, products, requisition] = await Promise.all([
    db.shop.findFirst({ where: { id: input.shopId, businessId: admin.businessId, isActive: true } }),
    db.supplier.findFirst({ where: { id: input.supplierId, businessId: admin.businessId, shopId: input.shopId, status: "ACTIVE" } }),
    db.product.findMany({ where: { businessId: admin.businessId, id: { in: input.items.map((item) => item.productId) }, status: "ACTIVE" }, include: { unit: true } }),
    input.requisitionId ? db.purchaseRequisition.findFirst({ where: { id: input.requisitionId, businessId: admin.businessId, shopId: input.shopId }, include: { items: true } }) : null,
  ]);
  if (!shop || !supplier) throw new AppError("The selected shop or supplier was not found.");
  if (input.requisitionId && !requisition) throw new AppError("The selected requisition was not found for this shop.", "REQUISITION_NOT_FOUND", 404);
  if (products.length !== input.items.length) throw new AppError("One or more selected products are unavailable.");
  if (requisition && requisition.status !== "APPROVED") throw new AppError("Only approved requisitions can be converted to purchase orders.");
  if (requisition?.supplierId && requisition.supplierId !== supplier.id) throw new AppError("Use the supplier assigned to this requisition when converting it to a purchase order.");
  if (requisition) {
    const requisitionItems = requisition.items as Array<{ id: string; productId: string }>;
    const requisitionItemByProductId = new Map(requisitionItems.map((item) => [item.productId, item]));
    const hasEveryRequestedLine = input.items.length === requisitionItems.length && input.items.every((item) => {
      const requested = requisitionItemByProductId.get(item.productId);
      return requested?.id === item.requisitionItemId;
    });
    if (!hasEveryRequestedLine) throw new AppError("A converted purchase order must contain each requested product exactly once.");
  }
  const productById = new Map(products.map((product) => [product.id, product]));
  const preparedItems = input.items.map((item) => {
    const product = productById.get(item.productId)!;
    const subtotal = item.quantity * item.unitCost;
    const taxAmount = subtotal * item.taxRate / 100;
    return { ...item, product, taxAmount, lineTotal: subtotal + taxAmount };
  });
  const subtotal = preparedItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const taxTotal = preparedItems.reduce((sum, item) => sum + item.taxAmount, 0);
  return db.$transaction(async (tx) => {
    if (input.requisitionId) {
      const currentRequisition = await tx.purchaseRequisition.findFirst({ where: { id: input.requisitionId, businessId: admin.businessId, shopId: shop.id, status: "APPROVED" } });
      if (!currentRequisition) throw new AppError("This requisition has already been converted or is no longer approved.");
    }
    const order = await tx.purchaseOrder.create({
      data: {
        businessId: admin.businessId, shopId: shop.id, supplierId: supplier.id, requisitionId: requisition?.id ?? null,
        purchaseOrderNumber: createDocumentNumber("PO", shop.code), status: "DRAFT", orderDate: new Date(), expectedDeliveryDate: input.expectedDeliveryDate ?? null,
        subtotal, taxTotal, grandTotal: subtotal + taxTotal, notes: input.notes ?? null, createdById: admin.id, approvalHistory: [],
        items: { create: preparedItems.map((item) => ({
          requisitionItemId: item.requisitionItemId ?? null, productId: item.product.id, unitId: item.unitId ?? item.product.unitId ?? null, productName: item.product.name,
          unitName: item.product.unit?.name ?? null, unitSymbol: item.product.unit?.symbol ?? null,
          orderedQuantity: item.quantity, receivedQuantity: 0, acceptedQuantity: 0, damagedQuantity: 0, rejectedQuantity: 0,
          unitCost: item.unitCost, taxRate: item.taxRate, taxAmount: item.taxAmount, lineTotal: item.lineTotal,
        })) },
      },
      include: { items: true },
    });
    if (requisition) {
      await tx.purchaseRequisition.update({ where: { id: requisition.id }, data: { status: "CONVERTED", convertedPurchaseOrderId: order.id, approvalHistory: appendHistory(requisition.approvalHistory, history("CONVERTED", admin.id, order.purchaseOrderNumber)) } });
    }
    await writeAuditLog(tx, { userId: admin.id, shopId: shop.id, action: "PURCHASE_ORDER_CREATED", entityType: "PURCHASE_ORDER", entityId: order.id, description: `Created purchase order ${order.purchaseOrderNumber} for ${supplier.name}.`, metadata: { requisitionId: requisition?.id ?? null, total: order.grandTotal } });
    return order;
  });
}

export async function submitPurchaseOrderForApproval(admin: AdminContext, input: z.infer<typeof purchaseOrderIdSchema>) {
  const order = await db.purchaseOrder.findFirst({ where: { id: input.purchaseOrderId, businessId: admin.businessId } });
  if (!order) throw new AppError("Purchase order not found.", "PURCHASE_ORDER_NOT_FOUND", 404);
  if (order.status !== "DRAFT") throw new AppError("Only draft purchase orders can be submitted.");
  const updated = await db.purchaseOrder.update({ where: { id: order.id }, data: { status: "PENDING_APPROVAL", approvalHistory: appendHistory(order.approvalHistory, history("SUBMITTED", admin.id, input.note)) } });
  await writeAuditLog(db, { userId: admin.id, shopId: order.shopId, action: "PURCHASE_ORDER_SUBMITTED", entityType: "PURCHASE_ORDER", entityId: order.id, description: `Submitted purchase order ${order.purchaseOrderNumber} for approval.` });
  return updated;
}

export async function approvePurchaseOrder(admin: AdminContext, input: z.infer<typeof purchaseOrderIdSchema>) {
  const order = await db.purchaseOrder.findFirst({ where: { id: input.purchaseOrderId, businessId: admin.businessId } });
  if (!order) throw new AppError("Purchase order not found.", "PURCHASE_ORDER_NOT_FOUND", 404);
  if (order.status !== "PENDING_APPROVAL") throw new AppError("Only submitted purchase orders can be approved.");
  const updated = await db.purchaseOrder.update({ where: { id: order.id }, data: { status: "APPROVED", approvedById: admin.id, approvedAt: new Date(), approvalHistory: appendHistory(order.approvalHistory, history("APPROVED", admin.id, input.note)) } });
  await writeAuditLog(db, { userId: admin.id, shopId: order.shopId, action: "PURCHASE_ORDER_APPROVED", entityType: "PURCHASE_ORDER", entityId: order.id, description: `Approved purchase order ${order.purchaseOrderNumber}.`, metadata: { note: input.note ?? null } });
  return updated;
}

export async function sendPurchaseOrderToSupplier(admin: AdminContext, input: z.infer<typeof purchaseOrderIdSchema>) {
  const order = await db.purchaseOrder.findFirst({ where: { id: input.purchaseOrderId, businessId: admin.businessId, status: "APPROVED" }, include: { shop: true, supplier: true, items: true } });
  if (!order || !order.shop || !order.supplier) throw new AppError("Approved purchase order was not found.", "PURCHASE_ORDER_NOT_FOUND", 404);
  if (!order.supplier.email?.trim()) throw new AppError("The supplier needs an email address before this order can be sent.");
  const notification = await db.supplierNotificationHistory.create({ data: { businessId: admin.businessId, shopId: order.shopId, supplierId: order.supplierId, referenceNumber: order.purchaseOrderNumber, status: "PENDING", notificationType: "PURCHASE_ORDER", productCount: order.items.length, emailAddress: order.supplier.email.trim(), subject: `Purchase order ${order.purchaseOrderNumber} from ${order.shop.name}`, pdfUrl: null } });
  const pdfDocument = React.createElement(PurchaseOrderPdf, {
    orderNumber: order.purchaseOrderNumber,
    orderDate: order.orderDate.toLocaleDateString("en-KE"),
    expectedDeliveryDate: order.expectedDeliveryDate?.toLocaleDateString("en-KE") ?? null,
    shopName: order.shop.name,
    supplierName: order.supplier.name,
    supplierCompany: order.supplier.company,
    supplierEmail: order.supplier.email,
    supplierPhone: order.supplier.phone,
    notes: order.notes,
    subtotal: order.subtotal,
    taxTotal: order.taxTotal,
    grandTotal: order.grandTotal,
    items: order.items.map((item: { productName: string; unitName?: string | null; orderedQuantity: number; unitCost: number; taxRate: number; lineTotal: number }) => ({ productName: item.productName, unitName: item.unitName, quantity: item.orderedQuantity, unitCost: item.unitCost, taxRate: item.taxRate, lineTotal: item.lineTotal })),
  }) as any;
  const purchaseOrderPdf = Buffer.from(await renderToBuffer(pdfDocument as any)).toString("base64");
  await queueNotification({ tx: db, businessId: admin.businessId, userId: admin.id, shopId: order.shopId, type: "SYSTEM", priority: "HIGH", title: `Purchase order sent: ${order.purchaseOrderNumber}`, message: `Purchase order sent to ${order.supplier.name}.`, actionUrl: "/admin/procurement", inApp: true, push: false, email: { to: order.supplier.email.trim(), subject: `Purchase order ${order.purchaseOrderNumber} from ${order.shop.name}`, html: supplierOrderEmail({ supplierName: order.supplier.name, shopName: order.shop.name, orderNumber: order.purchaseOrderNumber, items: order.items.map((item: { productName: string; orderedQuantity: number; unitName?: string | null; unitCost: number; lineTotal: number }) => ({ productName: item.productName, quantity: item.orderedQuantity, unitName: item.unitName, unitCost: item.unitCost, lineTotal: item.lineTotal })), total: order.grandTotal, notes: order.notes }), referenceType: "SUPPLIER_NOTIFICATION_HISTORY", referenceId: notification.id, attachments: [{ filename: `purchase-order-${order.purchaseOrderNumber}.pdf`, contentType: "application/pdf", content: purchaseOrderPdf }] } });
  const updated = await db.purchaseOrder.update({ where: { id: order.id }, data: { status: "SENT", sentById: admin.id, sentAt: new Date(), approvalHistory: appendHistory(order.approvalHistory, history("SENT", admin.id, input.note)) } });
  await db.supplierNotificationHistory.update({ where: { id: notification.id }, data: { status: "PENDING" } });
  await writeAuditLog(db, { userId: admin.id, shopId: order.shopId, action: "PURCHASE_ORDER_SENT", entityType: "PURCHASE_ORDER", entityId: order.id, description: `Sent purchase order ${order.purchaseOrderNumber} to ${order.supplier.name}.`, metadata: { email: order.supplier.email } });
  return updated;
}

export async function receiveGoods(actor: ProcurementActor, input: ReceiveGoodsInput) {
  return db.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findFirst({ where: { id: input.purchaseOrderId, businessId: actor.businessId, status: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] } }, include: { shop: true, supplier: true, items: { include: { product: true } } } });
    if (!order || !order.shop || !order.supplier) throw new AppError("An approved purchase order was not found.", "PURCHASE_ORDER_NOT_FOUND", 404);
    if (actor.shopId && actor.shopId !== order.shopId) throw new AppError("Goods can only be received by the shop named on the purchase order.", "SHOP_SCOPE_FORBIDDEN", 403);
    if (new Set(input.items.map((item) => item.purchaseOrderItemId)).size !== input.items.length) throw new AppError("Each purchase order item can only be received once per goods receipt.");

    const alreadyProcessed = await tx.goodsReceivedNote.findFirst({ where: { shopId: order.shopId, idempotencyKey: input.idempotencyKey } });
    if (alreadyProcessed) return alreadyProcessed;
    type ReceiptOrderItem = {
      id: string; productId: string; productName: string; orderedQuantity: number; receivedQuantity: number;
      unitCost: number; taxRate: number; product?: { defaultSellingPrice: number } | null;
    };
    const orderItems = new Map<string, ReceiptOrderItem>(
      (order.items as ReceiptOrderItem[]).map((item) => [item.id, item]),
    );
    for (const received of input.items) {
      const line = orderItems.get(received.purchaseOrderItemId);
      if (!line) throw new AppError("The receipt includes an item outside this purchase order.");
      const outstanding = line.orderedQuantity - line.receivedQuantity;
      if (received.receivedQuantity > outstanding + 0.000001) throw new AppError(`${line.productName} exceeds the outstanding quantity of ${outstanding}.`);
    }

    const receipt = await tx.goodsReceivedNote.create({ data: {
      businessId: actor.businessId, shopId: order.shopId, supplierId: order.supplierId, purchaseOrderId: order.id,
      goodsReceivedNumber: createDocumentNumber("GRN", order.shop.code), status: "FINALIZED", receivedById: actor.id, receivedAt: new Date(), notes: input.notes ?? null, idempotencyKey: input.idempotencyKey, finalizedAt: new Date(),
    } });

    let payableTotal = 0;
    for (const received of input.items) {
      const line = orderItems.get(received.purchaseOrderItemId)!;
      const acceptedQuantity = received.receivedQuantity - received.damagedQuantity - received.rejectedQuantity;
      const lineTotal = acceptedQuantity * line.unitCost * (1 + line.taxRate / 100);
      payableTotal += lineTotal;
      await tx.goodsReceivedNoteItem.create({ data: { goodsReceivedNoteId: receipt.id, purchaseOrderItemId: line.id, productId: line.productId, orderedQuantity: line.orderedQuantity, previouslyReceivedQuantity: line.receivedQuantity, receivedQuantity: received.receivedQuantity, damagedQuantity: received.damagedQuantity, rejectedQuantity: received.rejectedQuantity, acceptedQuantity, rejectionReason: received.rejectionReason ?? null, unitCost: line.unitCost, taxRate: line.taxRate, lineTotal } });
      await tx.purchaseOrderItem.update({ where: { id: line.id }, data: { receivedQuantity: { increment: received.receivedQuantity }, acceptedQuantity: { increment: acceptedQuantity }, damagedQuantity: { increment: received.damagedQuantity }, rejectedQuantity: { increment: received.rejectedQuantity } } });

      if (acceptedQuantity > 0) {
        const current = await tx.shopInventory.findUnique({ where: { shopId_productId: { shopId: order.shopId, productId: line.productId } } });
        const before = current?.quantity ?? 0;
        const weightedCost = before > 0 ? ((before * current!.costPrice) + (acceptedQuantity * line.unitCost)) / (before + acceptedQuantity) : line.unitCost;
        const inventory = await tx.shopInventory.upsert({ where: { shopId_productId: { shopId: order.shopId, productId: line.productId } }, update: { quantity: { increment: acceptedQuantity }, costPrice: weightedCost, lastStockedAt: new Date(), isAvailable: true, version: { increment: 1 } }, create: { shopId: order.shopId, productId: line.productId, quantity: acceptedQuantity, costPrice: line.unitCost, sellingPrice: line.product?.defaultSellingPrice ?? 0, lastStockedAt: new Date() } });
        await tx.stockMovement.create({ data: { shopId: order.shopId, productId: line.productId, type: "PURCHASE_RECEIPT", quantityChange: acceptedQuantity, quantityBefore: before, quantityAfter: inventory.quantity, referenceType: "GOODS_RECEIPT", referenceId: receipt.id, supplierId: order.supplierId, purchaseOrderId: order.id, goodsReceivedNoteId: receipt.id, receivedById: actor.id, unitCost: line.unitCost, note: `GRN ${receipt.goodsReceivedNumber}; PO ${order.purchaseOrderNumber}; supplier ${order.supplier.name}; unit cost ${line.unitCost}.` } });
        await reconcileStockAlert(tx, { businessId: actor.businessId, shopId: order.shopId, shopName: order.shop.name, productId: line.productId, productName: line.productName, quantity: inventory.quantity, reorderLevel: inventory.reorderLevel, criticalLevel: inventory.criticalLevel, adminId: actor.id, adminEmail: actor.email });
      }
    }

    const freshLines = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: order.id } });
    const fullyReceived = freshLines.every((line) => line.receivedQuantity >= line.orderedQuantity - 0.000001);
    await tx.purchaseOrder.update({ where: { id: order.id }, data: { status: fullyReceived ? "FULLY_RECEIVED" : "PARTIALLY_RECEIVED", deliveryStatus: fullyReceived ? "FULLY_RECEIVED" : "PARTIALLY_RECEIVED", approvalHistory: appendHistory(order.approvalHistory, history("RECEIVED", actor.id, receipt.goodsReceivedNumber)) } });
    if (fullyReceived && order.requisitionId) {
      const requisition = await tx.purchaseRequisition.findFirst({ where: { id: order.requisitionId, businessId: actor.businessId, status: "CONVERTED" } });
      if (requisition) await tx.purchaseRequisition.update({ where: { id: requisition.id }, data: { status: "COMPLETED", completedAt: new Date(), approvalHistory: appendHistory(requisition.approvalHistory, history("COMPLETED", actor.id, receipt.goodsReceivedNumber)) } });
    }
    if (payableTotal > 0) {
      await tx.supplierPayable.create({ data: { businessId: actor.businessId, shopId: order.shopId, supplierId: order.supplierId, purchaseOrderId: order.id, goodsReceivedNoteId: receipt.id, payableNumber: createDocumentNumber("PAY", order.shop.code), status: "OPEN", amountDue: payableTotal, amountPaid: 0, outstandingAmount: payableTotal, createdById: actor.id } });
    }
    await writeAuditLog(tx, { userId: actor.id, shopId: order.shopId, action: "GOODS_RECEIVED", entityType: "GOODS_RECEIVED_NOTE", entityId: receipt.id, description: `Finalized ${receipt.goodsReceivedNumber} against ${order.purchaseOrderNumber}.`, metadata: { purchaseOrderId: order.id, supplierId: order.supplierId, payableTotal, lines: input.items.length } });
    return receipt;
  });
}

export async function recordSupplierPayment(admin: AdminContext, input: SupplierPaymentInput) {
  return db.$transaction(async (tx) => {
    const payable = await tx.supplierPayable.findFirst({ where: { id: input.supplierPayableId, businessId: admin.businessId, status: { in: ["OPEN", "PARTIALLY_PAID"] } }, include: { supplier: true, shop: true } });
    if (!payable || !payable.shop || !payable.supplier) throw new AppError("Open supplier payable not found.", "PAYABLE_NOT_FOUND", 404);
    if (input.amount > payable.outstandingAmount + 0.000001) throw new AppError("The payment cannot exceed the remaining supplier balance.");
    const amountPaid = payable.amountPaid + input.amount;
    const outstandingAmount = Math.max(0, payable.amountDue - amountPaid);
    const updated = await tx.supplierPayable.update({ where: { id: payable.id }, data: { amountPaid, outstandingAmount, status: outstandingAmount <= 0.000001 ? "PAID" : "PARTIALLY_PAID", settledAt: outstandingAmount <= 0.000001 ? new Date() : null } });
    const payment = await tx.supplierPayment.create({ data: { supplierPayableId: payable.id, supplierId: payable.supplierId, shopId: payable.shopId, paymentNumber: createDocumentNumber("SPY", payable.shop.code), amount: input.amount, method: input.method, reference: input.reference ?? null, paidById: admin.id, paidAt: new Date(), note: input.note ?? null } });
    await writeAuditLog(tx, { userId: admin.id, shopId: payable.shopId, action: "SUPPLIER_PAYMENT_RECORDED", entityType: "SUPPLIER_PAYABLE", entityId: payable.id, description: `Recorded supplier payment ${payment.paymentNumber} for ${payable.supplier.name}.`, metadata: { amount: input.amount, method: input.method, outstandingAmount } });
    return { payable: updated, payment };
  });
}

export async function generateRequisitionsForActiveAlerts(admin: AdminContext) {
  const alerts = await db.inventoryAlert.findMany({ where: { shop: { businessId: admin.businessId }, status: { in: ["ACTIVE", "ACKNOWLEDGED"] }, type: { in: ["LOW_STOCK", "CRITICAL_STOCK", "OUT_OF_STOCK"] } }, include: { shop: true, product: { include: { unit: true } } } });
  const supplierProducts = await db.supplierProduct.findMany({ where: { supplier: { businessId: admin.businessId, status: "ACTIVE" } }, include: { supplier: true } });
  const supplierByShopProduct = new Map(supplierProducts.map((item) => [`${item.shopId}:${item.productId}`, item.supplier]));
  const bySupplier = new Map<string, Array<typeof alerts[number]>>();
  for (const alert of alerts) {
    const supplier = supplierByShopProduct.get(`${alert.shopId}:${alert.productId}`);
    if (!supplier) continue;
    const key = `${supplier.id}:${alert.shopId}`;
    const list = bySupplier.get(key) ?? [];
    list.push(alert);
    bySupplier.set(key, list);
  }
  let created = 0;
  for (const [key, entries] of bySupplier) {
    const [supplierId, shopId] = key.split(":");
    const active = await db.purchaseRequisition.findFirst({ where: { businessId: admin.businessId, shopId, supplierId, status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } }, include: { items: true } });
    const unrequested = entries.filter((entry) => !active?.items.some((item: { productId: string }) => item.productId === entry.productId));
    if (!unrequested.length) continue;
    const inventory = await db.shopInventory.findMany({ where: { shopId, productId: { in: unrequested.map((item) => item.productId) } } });
    const inventoryByProduct = new Map(inventory.map((item) => [item.productId, item]));
    if (active) {
      await db.purchaseRequisitionItem.createMany({ data: unrequested.map((entry) => { const row = inventoryByProduct.get(entry.productId); return { requisitionId: active.id, productId: entry.productId, unitId: entry.product?.unitId ?? null, productName: entry.product?.name ?? "Unknown product", unitName: entry.product?.unit?.name ?? null, unitSymbol: entry.product?.unit?.symbol ?? null, currentQuantity: row?.quantity ?? 0, restockThreshold: row?.reorderLevel ?? entry.thresholdQuantity, requestedQuantity: Math.max(1, row?.reorderQuantity ?? 0, (row?.reorderLevel ?? entry.thresholdQuantity) - (row?.quantity ?? 0)), notes: "Added from active stock alert" }; } ) });
      created += 1;
      continue;
    }
    await createPurchaseRequisition({ ...admin, shopId }, { supplierId, reason: "Automatically created from active low-stock alerts.", notes: undefined, items: unrequested.map((entry) => { const row = inventoryByProduct.get(entry.productId); return { productId: entry.productId, requestedQuantity: Math.max(1, row?.reorderQuantity ?? 0, (row?.reorderLevel ?? entry.thresholdQuantity) - (row?.quantity ?? 0)), notes: undefined }; }) });
    created += 1;
  }
  return { created };
}

export { activeOrderStatuses, statusTone };