import { defineModel, index, now } from "./model-definition";
import type {
  IdempotencyRecordDocument,
  OfflineDeviceDocument,
  OfflineSyncBatchDocument,
  OfflineSyncConflictDocument,
} from "./model.types";

export const OfflineDeviceModel = defineModel<OfflineDeviceDocument>({
  collection: "offlineDevices",
  required: ["shopId", "name", "offlineAccessExpiresAt"],
  defaults: { isTrusted: true, isActive: true, lastSeenAt: now },
  indexes: [index({ shopId: 1, isActive: 1 })],
});

export const OfflineSyncBatchModel = defineModel<OfflineSyncBatchDocument>({
  collection: "offlineSyncBatches",
  required: ["shopId", "deviceId"],
  defaults: {
    status: "PENDING",
    recordCount: 0,
    successCount: 0,
    conflictCount: 0,
    errorCount: 0,
    startedAt: now,
  },
  enums: { status: ["PENDING", "PROCESSING", "COMPLETED", "PARTIAL", "FAILED"] },
  indexes: [index({ shopId: 1, startedAt: -1 })],
  timestamps: false,
});

export const OfflineSyncConflictModel = defineModel<OfflineSyncConflictDocument>({
  collection: "offlineSyncConflicts",
  required: ["shopId", "deviceId", "type", "entityType", "entityReference", "details"],
  defaults: { status: "OPEN", createdAt: now },
  enums: {
    type: [
      "INSUFFICIENT_SERVER_STOCK", "PRODUCT_DEACTIVATED", "PRICE_CHANGED",
      "CREDIT_LIMIT_EXCEEDED", "CREDIT_ACCOUNT_RESTRICTED", "MIXED_UNIT_SALE",
      "REGISTER_CLOSED", "INVALID_SHOP_SESSION", "DUPLICATE_MUTATION",
    ],
    status: ["OPEN", "REVIEWED", "RESOLVED"],
  },
  indexes: [index({ shopId: 1, status: 1, createdAt: -1 })],
  timestamps: false,
});

export const IdempotencyRecordModel = defineModel<IdempotencyRecordDocument>({
  collection: "idempotencyRecords",
  required: ["key", "shopId", "operation"],
  defaults: { processedAt: now },
  indexes: [
    index({ key: 1 }, { unique: true }),
    index({ shopId: 1, processedAt: -1 }),
    index(
      { expiresAt: 1 },
      {
        expireAfterSeconds: 0,
        partialFilterExpression: { expiresAt: { $type: "date" } },
      },
    ),
  ],
  timestamps: false,
});

export const offlineModels = {
  offlineDevice: OfflineDeviceModel,
  offlineSyncBatch: OfflineSyncBatchModel,
  offlineSyncConflict: OfflineSyncConflictModel,
  idempotencyRecord: IdempotencyRecordModel,
};
