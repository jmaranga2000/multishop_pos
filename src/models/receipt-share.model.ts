import { defineModel, index, now } from "./model-definition";
import type { ReceiptShareDocument } from "./model.types";

export const ReceiptShareModel = defineModel<ReceiptShareDocument>({
  collection: "receiptShares",
  required: ["token", "receipt", "expiresAt"],
  defaults: { createdAt: now },
  indexes: [
    index({ token: 1 }, { unique: true }),
    index({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ],
  timestamps: false,
});

export const receiptShareModels = { receiptShare: ReceiptShareModel };