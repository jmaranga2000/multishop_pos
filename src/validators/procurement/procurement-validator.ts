import { z } from "zod";

const optionalText = z.string().trim().max(1_000).optional().transform((value) => value || undefined);
const optionalId = z.preprocess((value) => value === "" || value === null ? undefined : value, z.string().min(1).optional());

export const requisitionItemSchema = z.object({
  productId: z.string().min(1),
  unitId: optionalId,
  requestedQuantity: z.coerce.number().positive().max(1_000_000),
  notes: optionalText,
});

export const createRequisitionSchema = z.object({
  supplierId: optionalId,
  reason: optionalText,
  notes: optionalText,
  items: z.array(requisitionItemSchema).min(1).max(500),
});

export const requisitionDecisionSchema = z.object({
  requisitionId: z.string().min(1),
  note: optionalText,
});

export const purchaseOrderLineSchema = z.object({
  requisitionItemId: z.string().min(1).optional(),
  productId: z.string().min(1),
  unitId: optionalId,
  quantity: z.coerce.number().positive().max(1_000_000),
  unitCost: z.coerce.number().nonnegative().max(1_000_000_000),
  taxRate: z.coerce.number().min(0).max(100).default(0),
});

export const createPurchaseOrderSchema = z.object({
  requisitionId: optionalId,
  shopId: z.string().min(1),
  supplierId: z.string().min(1),
  expectedDeliveryDate: z.coerce.date().optional(),
  notes: optionalText,
  items: z.array(purchaseOrderLineSchema).min(1).max(500),
});

export const purchaseOrderIdSchema = z.object({
  purchaseOrderId: z.string().min(1),
  note: optionalText,
});

export const receiveGoodsItemSchema = z.object({
  purchaseOrderItemId: z.string().min(1),
  receivedQuantity: z.coerce.number().positive().max(1_000_000),
  damagedQuantity: z.coerce.number().nonnegative().max(1_000_000).default(0),
  rejectedQuantity: z.coerce.number().nonnegative().max(1_000_000).default(0),
  rejectionReason: optionalText,
}).superRefine((value, context) => {
  if (value.damagedQuantity + value.rejectedQuantity > value.receivedQuantity) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Damaged and rejected quantities cannot exceed the received quantity.", path: ["receivedQuantity"] });
  }
  if (value.rejectedQuantity > 0 && !value.rejectionReason) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Give a rejection reason for rejected goods.", path: ["rejectionReason"] });
  }
});

export const receiveGoodsSchema = z.object({
  purchaseOrderId: z.string().min(1),
  idempotencyKey: z.string().uuid(),
  notes: optionalText,
  items: z.array(receiveGoodsItemSchema).min(1).max(500),
});

export const supplierPaymentSchema = z.object({
  supplierPayableId: z.string().min(1),
  amount: z.coerce.number().positive().max(1_000_000_000),
  method: z.enum(["CASH", "MPESA", "BANK_TRANSFER", "CARD"]),
  reference: optionalText,
  note: optionalText,
});

export const purchaseOrderFilterSchema = z.object({
  shopId: z.string().min(1).optional(),
  supplierId: optionalId,
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CANCELLED", "CLOSED"]).optional(),
});