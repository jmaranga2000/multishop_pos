import { defineModel, index, now } from "./model-definition";
import type {
  InventoryAlertDocument,
  ShopInventoryDocument,
  StockMovementDocument,
  StockTransferDocument,
  StockTransferItemDocument,
} from "./model.types";

export const ShopInventoryModel = defineModel<ShopInventoryDocument>({
  collection: "shopInventories",
  required: ["shopId", "productId", "costPrice", "sellingPrice"],
  defaults: {
    quantity: 0,
    reservedQuantity: 0,
    reorderLevel: 10,
    criticalLevel: 5,
    reorderQuantity: 20,
    isAvailable: true,
    version: 1,
  },
  indexes: [
    index({ shopId: 1, productId: 1 }, { unique: true }),
    index({ shopId: 1, quantity: 1 }),
    index({ productId: 1 }),
  ],
});

export const StockMovementModel = defineModel<StockMovementDocument>({
  collection: "stockMovements",
  required: [
    "shopId", "productId", "type", "quantityChange", "quantityBefore", "quantityAfter",
  ],
  defaults: { createdAt: now },
  enums: {
    type: [
      "OPENING_STOCK", "PURCHASE_RECEIPT", "SALE", "CUSTOMER_RETURN",
      "TRANSFER_OUT", "TRANSFER_IN", "DAMAGE", "EXPIRY", "THEFT",
      "STOCK_COUNT", "MANUAL_ADJUSTMENT", "OFFLINE_RECONCILIATION",
    ],
  },
  indexes: [
    index({ shopId: 1, productId: 1, createdAt: 1 }),
    index({ referenceType: 1, referenceId: 1 }),
  ],
  timestamps: false,
});

export const StockTransferModel = defineModel<StockTransferDocument>({
  collection: "stockTransfers",
  required: ["transferNumber", "sourceShopId", "destinationShopId"],
  defaults: { status: "DRAFT" },
  enums: {
    status: ["DRAFT", "DISPATCHED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
  },
  indexes: [
    index({ transferNumber: 1 }, { unique: true }),
    index({ sourceShopId: 1, status: 1 }),
    index({ destinationShopId: 1, status: 1 }),
  ],
});

export const StockTransferItemModel = defineModel<StockTransferItemDocument>({
  collection: "stockTransferItems",
  required: ["transferId", "productId", "requestedQuantity"],
  defaults: { dispatchedQuantity: 0, receivedQuantity: 0, damagedQuantity: 0 },
  indexes: [index({ transferId: 1, productId: 1 }, { unique: true })],
  timestamps: false,
});

export const InventoryAlertModel = defineModel<InventoryAlertDocument>({
  collection: "inventoryAlerts",
  required: ["shopId", "productId", "type", "currentQuantity", "thresholdQuantity"],
  defaults: { status: "ACTIVE", firstTriggeredAt: now, lastTriggeredAt: now },
  enums: {
    type: ["LOW_STOCK", "CRITICAL_STOCK", "OUT_OF_STOCK"],
    status: ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"],
  },
  indexes: [
    index({ shopId: 1, status: 1, type: 1 }),
    index({ productId: 1, status: 1 }),
  ],
});

export const inventoryModels = {
  shopInventory: ShopInventoryModel,
  stockMovement: StockMovementModel,
  stockTransfer: StockTransferModel,
  stockTransferItem: StockTransferItemModel,
  inventoryAlert: InventoryAlertModel,
};
