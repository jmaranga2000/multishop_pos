import { defineModel, index, now } from "./model-definition";
import type { SupplierDocument, SupplierProductDocument, SupplierNotificationHistoryDocument } from "./model.types";

export const SupplierModel = defineModel<SupplierDocument>({
  collection: "suppliers",
  required: ["businessId", "shopId", "name", "company", "email", "phone", "status"],
  defaults: {
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  },
  indexes: [
    index({ businessId: 1, shopId: 1 }),
    index({ shopId: 1 }),
    index({ email: 1 }),
  ],
});

export const SupplierProductModel = defineModel<SupplierProductDocument>({
  collection: "supplierProducts",
  required: ["supplierId", "shopId", "productId", "targetQuantity"],
  defaults: {
    lastNotificationAt: null,
    lastNotifiedQuantity: null,
    lastNotifiedStatus: null,
    createdAt: now,
    updatedAt: now,
  },
  indexes: [
    index({ supplierId: 1, productId: 1 }, { unique: true }),
    index({ shopId: 1, productId: 1 }),
    index({ productId: 1 }),
  ],
});

export const SupplierNotificationHistoryModel = defineModel<SupplierNotificationHistoryDocument>({
  collection: "supplierNotificationHistory",
  required: ["businessId", "shopId", "supplierId", "referenceNumber", "status", "productCount", "emailAddress"],
  defaults: {
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
  },
  enums: {
    status: ["PENDING", "SENT", "FAILED"],
    notificationType: ["RESTOCK_REQUEST", "PURCHASE_ORDER", "TEST_EMAIL"],
  },
  indexes: [
    index({ businessId: 1, shopId: 1 }),
    index({ supplierId: 1 }),
    index({ referenceNumber: 1 }, { unique: true }),
  ],
});

export const supplierModels = {
  supplier: SupplierModel,
  supplierProduct: SupplierProductModel,
  supplierNotificationHistory: SupplierNotificationHistoryModel,
};
