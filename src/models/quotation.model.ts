import { defineModel, index } from "./model-definition";
import type { QuotationDocument } from "./model.types";

export const QuotationModel = defineModel<QuotationDocument>({
  collection: "quotations",
  required: ["businessId", "shopId", "quotationNumber", "status", "issuedAt", "validUntil", "subtotal", "discountTotal", "vatTotal", "grandTotal", "items", "shareToken"],
  defaults: { status: "ISSUED", discountTotal: 0, vatTotal: 0, grandTotal: 0, items: [], notes: null },
  enums: { status: ["ISSUED", "CONVERTED", "EXPIRED", "CANCELLED"] },
  indexes: [
    index({ businessId: 1, quotationNumber: 1 }, { unique: true }),
    index({ shareToken: 1 }, { unique: true }),
    index({ shopId: 1, status: 1, issuedAt: -1 }),
  ],
  timestamps: false,
});

export const quotationModels = { quotation: QuotationModel };