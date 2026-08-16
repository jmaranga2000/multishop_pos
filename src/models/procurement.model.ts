import { defineModel, index, now } from "./model-definition";
import type {
  GoodsReceivedNoteDocument,
  GoodsReceivedNoteItemDocument,
  PurchaseOrderDocument,
  PurchaseOrderItemDocument,
  PurchaseRequisitionDocument,
  PurchaseRequisitionItemDocument,
  SupplierPayableDocument,
  SupplierPaymentDocument,
} from "./model.types";

export const PurchaseRequisitionModel = defineModel<PurchaseRequisitionDocument>({
  collection: "purchaseRequisitions",
  required: ["businessId", "shopId", "requisitionNumber", "status", "requestedById", "approvalHistory"],
  defaults: { status: "DRAFT", approvalHistory: [], createdAt: now, updatedAt: now },
  enums: { status: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CONVERTED", "CANCELLED", "COMPLETED"] },
  indexes: [
    index({ requisitionNumber: 1 }, { unique: true }),
    index({ businessId: 1, shopId: 1, status: 1, createdAt: -1 }),
    index({ supplierId: 1, status: 1 }),
  ],
});

export const PurchaseRequisitionItemModel = defineModel<PurchaseRequisitionItemDocument>({
  collection: "purchaseRequisitionItems",
  required: ["requisitionId", "productId", "productName", "currentQuantity", "restockThreshold", "requestedQuantity"],
  indexes: [index({ requisitionId: 1, productId: 1 }, { unique: true }), index({ productId: 1 })],
});

export const PurchaseOrderModel = defineModel<PurchaseOrderDocument>({
  collection: "purchaseOrders",
  required: ["businessId", "shopId", "supplierId", "purchaseOrderNumber", "status", "orderDate", "subtotal", "taxTotal", "grandTotal", "createdById", "approvalHistory"],
  defaults: { status: "DRAFT", subtotal: 0, taxTotal: 0, grandTotal: 0, approvalHistory: [], createdAt: now, updatedAt: now },
  enums: { status: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CANCELLED", "CLOSED"] },
  indexes: [
    index({ purchaseOrderNumber: 1 }, { unique: true }),
    index({ businessId: 1, shopId: 1, status: 1, createdAt: -1 }),
    index({ supplierId: 1, status: 1 }),
    index({ requisitionId: 1 }, { sparse: true }),
  ],
});

export const PurchaseOrderItemModel = defineModel<PurchaseOrderItemDocument>({
  collection: "purchaseOrderItems",
  required: ["purchaseOrderId", "productId", "productName", "orderedQuantity", "receivedQuantity", "acceptedQuantity", "damagedQuantity", "rejectedQuantity", "unitCost", "taxRate", "taxAmount", "lineTotal"],
  defaults: { receivedQuantity: 0, acceptedQuantity: 0, damagedQuantity: 0, rejectedQuantity: 0, taxRate: 0, taxAmount: 0, lineTotal: 0 },
  indexes: [index({ purchaseOrderId: 1, productId: 1 }, { unique: true }), index({ productId: 1 })],
});

export const GoodsReceivedNoteModel = defineModel<GoodsReceivedNoteDocument>({
  collection: "goodsReceivedNotes",
  required: ["businessId", "shopId", "supplierId", "purchaseOrderId", "goodsReceivedNumber", "status", "receivedById", "receivedAt", "idempotencyKey"],
  defaults: { status: "DRAFT", createdAt: now, updatedAt: now },
  enums: { status: ["DRAFT", "FINALIZED", "CANCELLED"] },
  indexes: [
    index({ goodsReceivedNumber: 1 }, { unique: true }),
    index({ shopId: 1, purchaseOrderId: 1, receivedAt: -1 }),
    index({ shopId: 1, idempotencyKey: 1 }, { unique: true }),
  ],
});

export const GoodsReceivedNoteItemModel = defineModel<GoodsReceivedNoteItemDocument>({
  collection: "goodsReceivedNoteItems",
  required: ["goodsReceivedNoteId", "purchaseOrderItemId", "productId", "orderedQuantity", "previouslyReceivedQuantity", "receivedQuantity", "damagedQuantity", "rejectedQuantity", "acceptedQuantity", "unitCost", "taxRate", "lineTotal"],
  defaults: { damagedQuantity: 0, rejectedQuantity: 0, acceptedQuantity: 0, taxRate: 0, lineTotal: 0 },
  indexes: [index({ goodsReceivedNoteId: 1, purchaseOrderItemId: 1 }, { unique: true }), index({ productId: 1 })],
});

export const SupplierPayableModel = defineModel<SupplierPayableDocument>({
  collection: "supplierPayables",
  required: ["businessId", "shopId", "supplierId", "payableNumber", "status", "amountDue", "amountPaid", "outstandingAmount", "createdById"],
  defaults: { status: "OPEN", amountPaid: 0, outstandingAmount: 0, createdAt: now, updatedAt: now },
  enums: { status: ["OPEN", "PARTIALLY_PAID", "PAID", "VOIDED"] },
  indexes: [
    index({ payableNumber: 1 }, { unique: true }),
    index({ businessId: 1, shopId: 1, status: 1 }),
    index({ goodsReceivedNoteId: 1 }, { unique: true, sparse: true }),
    index({ supplierId: 1, status: 1 }),
  ],
});

export const SupplierPaymentModel = defineModel<SupplierPaymentDocument>({
  collection: "supplierPayments",
  required: ["supplierPayableId", "supplierId", "shopId", "paymentNumber", "amount", "method", "paidById", "paidAt"],
  defaults: { createdAt: now },
  enums: { method: ["CASH", "MPESA", "BANK_TRANSFER", "CARD"] },
  indexes: [index({ paymentNumber: 1 }, { unique: true }), index({ supplierPayableId: 1, paidAt: -1 }), index({ supplierId: 1, paidAt: -1 })],
  timestamps: false,
});

export const procurementModels = {
  purchaseRequisition: PurchaseRequisitionModel,
  purchaseRequisitionItem: PurchaseRequisitionItemModel,
  purchaseOrder: PurchaseOrderModel,
  purchaseOrderItem: PurchaseOrderItemModel,
  goodsReceivedNote: GoodsReceivedNoteModel,
  goodsReceivedNoteItem: GoodsReceivedNoteItemModel,
  supplierPayable: SupplierPayableModel,
  supplierPayment: SupplierPaymentModel,
};