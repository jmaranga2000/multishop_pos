import { defineModel, index } from "./model-definition";
import type {
  InventoryReportDocument,
  InventoryReportItemDocument,
} from "./model.types";

export const InventoryReportModel = defineModel<InventoryReportDocument>({
  collection: "inventoryReports",
  required: ["businessId", "periodStart", "periodEnd"],
  defaults: {
    status: "PENDING",
    totalStockQuantity: 0,
    totalCostValue: 0,
    totalSellingValue: 0,
    lowStockCount: 0,
    criticalStockCount: 0,
    outOfStockCount: 0,
  },
  enums: { status: ["PENDING", "COMPLETED", "FAILED"] },
  indexes: [
    index({ businessId: 1, periodStart: 1, periodEnd: 1 }, { unique: true }),
  ],
});

export const InventoryReportItemModel = defineModel<InventoryReportItemDocument>({
  collection: "inventoryReportItems",
  required: ["reportId", "shopId", "productId", "reorderLevel", "criticalLevel", "stockStatus"],
  defaults: {
    openingQuantity: 0,
    quantityAdded: 0,
    quantitySold: 0,
    quantityTransferredIn: 0,
    quantityTransferredOut: 0,
    quantityDamaged: 0,
    closingQuantity: 0,
    averageDailySales: 0,
    estimatedDaysRemaining: null,
    costValue: 0,
    sellingValue: 0,
  },
  indexes: [
    index({ reportId: 1, shopId: 1, productId: 1 }, { unique: true }),
    index({ shopId: 1, stockStatus: 1 }),
  ],
  timestamps: false,
});

export const reportingModels = {
  inventoryReport: InventoryReportModel,
  inventoryReportItem: InventoryReportItemModel,
};
