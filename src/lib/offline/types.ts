export type OfflineProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  /** Percentage included in the selling price, e.g. 16 for Kenya VAT. */
  taxRate: number;
  status: "ACTIVE" | "INACTIVE";
  unitId?: string | null;
  unitName?: string | null;
  unitSymbol?: string | null;
  pricingOptions?: Array<{
    unitId: string;
    unitName?: string | null;
    unitSymbol?: string | null;
    costPriceMinor: number;
    sellingPriceMinor: number;
  }>;
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

export type PaymentEntry = {
  method: "CASH" | "MPESA" | "CARD" | "BANK_TRANSFER" | "CREDIT";
  amountMinor: number;
  reference?: string | null;
};

export type OfflineSale = {
  localId: string;
  idempotencyKey: string;
  shopId: string;
  deviceId: string;
  salespersonId: string | null;
  registerSessionId: string | null;
  customerId?: string | null;
  customerName: string | null;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  changeDueMinor: number;
  /** @deprecated Use payments array instead */
  paymentMethod: "CASH" | "MPESA" | "CARD" | "BANK_TRANSFER" | "SPLIT" | "CREDIT";
  /** @deprecated Use payments array instead */
  paymentReference: string | null;
  payments: PaymentEntry[];
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
  unitId?: string | null;
  unitName?: string | null;
  unitSymbol?: string | null;
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
