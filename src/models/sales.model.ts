import { defineModel, index, now } from "./model-definition";
import type {
  PaymentDocument,
  RefundDocument,
  RefundItemDocument,
  RefundRequestDocument,
  RegisterDocument,
  RegisterSessionDocument,
  RegisterTransactionDocument,
  SaleDocument,
  SaleItemDocument,
} from "./model.types";

export const RegisterModel = defineModel<RegisterDocument>({
  collection: "registers",
  required: ["shopId", "name", "code"],
  defaults: { isActive: true },
  indexes: [index({ shopId: 1, code: 1 }, { unique: true })],
});

export const RegisterSessionModel = defineModel<RegisterSessionDocument>({
  collection: "registerSessions",
  required: ["shopId", "registerId", "openingCash"],
  defaults: { status: "OPEN", openedAt: now },
  enums: { status: ["OPEN", "CLOSED"] },
  indexes: [
    index(
      { localReference: 1 },
      { unique: true, partialFilterExpression: { localReference: { $type: "string" } } },
    ),
    index({ shopId: 1, status: 1 }),
  ],
});

export const RegisterTransactionModel = defineModel<RegisterTransactionDocument>({
  collection: "registerTransactions",
  required: ["registerSessionId", "type", "amount"],
  defaults: { createdAt: now, source: "CASH" },
  enums: { source: ["CASH", "MPESA"] },
  indexes: [index({ registerSessionId: 1, createdAt: 1 })],
  timestamps: false,
});

export const SaleModel = defineModel<SaleDocument>({
  collection: "sales",
  required: ["shopId", "receiptNumber", "subtotal", "total", "amountPaid", "occurredAt"],
  defaults: {
    status: "PENDING",
    discountTotal: 0,
    taxTotal: 0,
    changeDue: 0,
    isOffline: false,
    checkoutMode: "NORMAL",
    taxableAmount: 0,
    vatAmount: 0,
    vatRate: 0,
    taxTreatment: "NOT_APPLICABLE",
    etimsStatus: "NOT_APPLICABLE",
  },
  enums: {
    status: ["PENDING", "COMPLETED", "VOIDED", "REFUNDED"],
    checkoutMode: ["NORMAL", "ETIMS"],
    taxTreatment: ["STANDARD", "ZERO_RATED", "EXEMPT", "MIXED", "NOT_APPLICABLE"],
    etimsStatus: ["NOT_APPLICABLE", "ETIMS_PENDING", "ETIMS_SUBMITTING", "ETIMS_SUCCESS", "ETIMS_FAILED", "ETIMS_RETRY_REQUIRED", "ETIMS_REJECTED", "ETIMS_CANCELLED"],
  },
  indexes: [
    index({ receiptNumber: 1 }, { unique: true }),
    index(
      { clientReference: 1 },
      { unique: true, partialFilterExpression: { clientReference: { $type: "string" } } },
    ),
    index({ shopId: 1, occurredAt: 1 }),
    index({ salespersonId: 1, occurredAt: 1 }),
    index({ checkoutMode: 1, etimsStatus: 1, occurredAt: 1 }),
  ],
});

export const SaleItemModel = defineModel<SaleItemDocument>({
  collection: "saleItems",
  required: [
    "saleId", "productId", "productName", "sku", "quantity", "unitCost",
    "unitPrice", "lineTotal",
  ],
  defaults: { discountTotal: 0, taxTotal: 0, vatRate: 0, taxTreatment: "NOT_APPLICABLE" },
  enums: { taxTreatment: ["STANDARD", "ZERO_RATED", "EXEMPT", "NOT_APPLICABLE"] },
  indexes: [index({ saleId: 1 }), index({ productId: 1 })],
  timestamps: false,
});
export const PaymentModel = defineModel<PaymentDocument>({
  collection: "payments",
  required: ["saleId", "method", "amount"],
  defaults: { status: "VERIFIED", createdAt: now },
  enums: {
    method: ["CASH", "MPESA", "CARD", "BANK_TRANSFER", "MIXED"],
    status: ["PENDING", "VERIFIED", "FAILED"],
  },
  indexes: [index({ saleId: 1, method: 1 })],
  timestamps: false,
});

export const RefundRequestModel = defineModel<RefundRequestDocument>({
  collection: "refundRequests",
  required: ["saleId", "shopId", "reason", "requestType", "refundMethod", "restockReturnedProducts", "markItemsAsDamaged", "requestManagerApproval"],
  defaults: {
    status: "PENDING",
    requestType: "FULL_SALE",
    refundMethod: "CASH",
    selectedItemIds: [],
    restockReturnedProducts: true,
    markItemsAsDamaged: false,
    requestManagerApproval: false,
    requestedAt: now,
  },
  enums: { status: ["PENDING", "APPROVED", "REJECTED", "COMPLETED"] },
  indexes: [index({ shopId: 1, status: 1 })],
  timestamps: false,
});

export const RefundModel = defineModel<RefundDocument>({
  collection: "refunds",
  required: ["saleId", "refundNumber", "total", "reason"],
  defaults: { status: "COMPLETED", createdAt: now },
  enums: { status: ["PENDING", "APPROVED", "REJECTED", "COMPLETED"] },
  indexes: [index({ refundNumber: 1 }, { unique: true })],
  timestamps: false,
});

export const RefundItemModel = defineModel<RefundItemDocument>({
  collection: "refundItems",
  required: ["refundId", "productId", "quantity", "amount"],
  defaults: { restock: true },
  timestamps: false,
});

export const salesModels = {
  register: RegisterModel,
  registerSession: RegisterSessionModel,
  registerTransaction: RegisterTransactionModel,
  sale: SaleModel,
  saleItem: SaleItemModel,
  payment: PaymentModel,
  refundRequest: RefundRequestModel,
  refund: RefundModel,
  refundItem: RefundItemModel,
};
