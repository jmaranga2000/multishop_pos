import { defineModel, index, now } from "./model-definition";
import type {
  EtimsConfigurationDocument,
  EtimsTransactionDocument,
  TaxSettingsDocument,
} from "./model.types";

export const TaxSettingsModel = defineModel<TaxSettingsDocument>({
  collection: "taxSettings",
  required: ["businessId"],
  defaults: {
    vatEnabled: true,
    standardVatRate: 16,
    priceTaxMode: "VAT_EXCLUSIVE",
    allowShopEtimsCheckout: false,
  },
  enums: { priceTaxMode: ["VAT_EXCLUSIVE", "VAT_INCLUSIVE"] },
  indexes: [index({ businessId: 1 }, { unique: true })],
});

export const EtimsConfigurationModel = defineModel<EtimsConfigurationDocument>({
  collection: "etimsConfigurations",
  required: ["businessId", "shopId"],
  defaults: { enabled: false, integrationMode: "OSCU" },
  enums: { integrationMode: ["OSCU", "VSCU"] },
  indexes: [
    index({ shopId: 1 }, { unique: true }),
    index({ businessId: 1, enabled: 1 }),
  ],
});

export const EtimsTransactionModel = defineModel<EtimsTransactionDocument>({
  collection: "etimsTransactions",
  required: ["saleId", "businessId", "shopId", "status", "requestReference", "taxableAmount", "vatAmount", "grossAmount", "vatRate"],
  defaults: { status: "ETIMS_PENDING", retryCount: 0, createdAt: now },
  enums: {
    status: [
      "ETIMS_PENDING",
      "ETIMS_SUBMITTING",
      "ETIMS_SUCCESS",
      "ETIMS_FAILED",
      "ETIMS_RETRY_REQUIRED",
      "ETIMS_REJECTED",
      "ETIMS_CANCELLED",
    ],
  },
  indexes: [
    index({ saleId: 1 }, { unique: true }),
    index({ requestReference: 1 }, { unique: true }),
    index({ businessId: 1, shopId: 1, status: 1, createdAt: -1 }),
  ],
});

export const etimsModels = {
  taxSettings: TaxSettingsModel,
  etimsConfiguration: EtimsConfigurationModel,
  etimsTransaction: EtimsTransactionModel,
};