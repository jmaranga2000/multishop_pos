import { defineModel, index, now } from "./model-definition";
import type { StocktakeDocument, StocktakeItemDocument } from "./model.types";

export const StocktakeModel = defineModel<StocktakeDocument>({
  collection: "stocktakes",
  required: ["businessId", "shopId", "stocktakeNumber", "status", "startedById", "startedAt", "approvalHistory"],
  defaults: { status: "DRAFT", approvalHistory: [], createdAt: now, updatedAt: now },
  enums: { status: ["DRAFT", "COUNTING", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "COMPLETED", "CANCELLED"] },
  indexes: [
    index({ stocktakeNumber: 1 }, { unique: true }),
    index({ businessId: 1, shopId: 1, status: 1, startedAt: -1 }),
    index({ shopId: 1, completedAt: -1 }),
  ],
});

export const StocktakeItemModel = defineModel<StocktakeItemDocument>({
  collection: "stocktakeItems",
  required: ["stocktakeId", "productId", "productName", "sku", "systemQuantity"],
  enums: { varianceReason: ["DAMAGED_GOODS", "EXPIRED_GOODS", "THEFT_LOSS", "UNRECORDED_SALE", "RECEIVING_ERROR", "TRANSFER_ERROR", "COUNTING_ERROR", "DATA_ENTRY_ERROR", "OTHER"] },
  indexes: [index({ stocktakeId: 1, productId: 1 }, { unique: true }), index({ productId: 1 })],
});

export const stocktakeModels = { stocktake: StocktakeModel, stocktakeItem: StocktakeItemModel };