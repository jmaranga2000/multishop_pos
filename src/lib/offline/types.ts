export type OfflineProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  status: "ACTIVE" | "INACTIVE";
};

export type OfflineInventory = {
  id: string;
  shopId: string;
  productId: string;
  serverQuantity: number;
  projectedQuantity: number;
  sellingPriceMinor: number;
  costPriceMinor: number;
  reorderLevel: number;
  criticalLevel: number;
  isAvailable: boolean;
  version: number;
  syncedAt: string;
};

export type OfflineSale = {
  localId: string;
  idempotencyKey: string;
  shopId: string;
  deviceId: string;
  salespersonId: string | null;
  registerSessionId: string | null;
  customerName: string | null;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  changeDueMinor: number;
  paymentMethod: "CASH" | "MPESA" | "CARD" | "BANK_TRANSFER";
  paymentReference: string | null;
  occurredAt: string;
  status: "LOCAL_ONLY" | "PENDING_SYNC" | "SYNCING" | "SYNCED" | "FAILED" | "CONFLICT";
  serverId?: string;
  receiptNumber?: string;
  lastError?: string;
};

export type OfflineSaleItem = {
  id: string;
  saleLocalId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPriceMinor: number;
  unitCostMinor: number;
  lineTotalMinor: number;
};

export type SyncQueueItem = {
  id: string;
  entityType: "SALE";
  entityId: string;
  idempotencyKey: string;
  shopId: string;
  deviceId: string;
  status: "PENDING_SYNC" | "SYNCING" | "FAILED" | "CONFLICT";
  attempts: number;
  nextAttemptAt: string;
  lastError?: string;
  createdAt: string;
};
