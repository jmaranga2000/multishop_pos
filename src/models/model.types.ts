export type IndexDescription = import("mongoose").mongo.IndexDescription;

export interface BaseDocument {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserRole = "ADMIN" | "SHOP";
export type AccountStatus = "ACTIVE" | "SUSPENDED";
export type ProductStatus = "ACTIVE" | "INACTIVE";
export type RegisterSessionStatus = "OPEN" | "CLOSED";
export type SaleStatus = "PENDING" | "COMPLETED" | "VOIDED" | "REFUNDED";
export type PaymentMethod = "CASH" | "MPESA" | "CARD" | "BANK_TRANSFER" | "MIXED";
export type PaymentStatus = "PENDING" | "VERIFIED" | "FAILED";
export type TransferStatus = "DRAFT" | "DISPATCHED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
export type RefundStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
export type ExpenseStatus = "PENDING" | "APPROVED" | "REJECTED";
export type QueueStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED";
export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type ReportStatus = "PENDING" | "COMPLETED" | "FAILED";
export type SyncBatchStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "PARTIAL" | "FAILED";
export type ConflictStatus = "OPEN" | "REVIEWED" | "RESOLVED";
export type AlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
export type InventoryAlertType = "LOW_STOCK" | "CRITICAL_STOCK" | "OUT_OF_STOCK";
export type NotificationType =
  | InventoryAlertType | "WEEKLY_REPORT" | "REFUND_REQUEST"
  | "REGISTER_DISCREPANCY" | "SYNC_CONFLICT" | "STOCK_TRANSFER" | "SYSTEM";
export type StockMovementType =
  | "OPENING_STOCK" | "PURCHASE_RECEIPT" | "SALE" | "CUSTOMER_RETURN"
  | "TRANSFER_OUT" | "TRANSFER_IN" | "DAMAGE" | "EXPIRY" | "THEFT"
  | "STOCK_COUNT" | "MANUAL_ADJUSTMENT" | "OFFLINE_RECONCILIATION";
export type ConflictType =
  | "INSUFFICIENT_SERVER_STOCK" | "PRODUCT_DEACTIVATED" | "PRICE_CHANGED"
  | "REGISTER_CLOSED" | "INVALID_SHOP_SESSION" | "DUPLICATE_MUTATION";

export interface BusinessDocument extends BaseDocument {
  name: string;
  code: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxPin?: string | null;
  currency: string;
  timezone: string;
  logoUrl?: string | null;
  receiptFooter?: string | null;
  defaultReorderLevel: number;
  defaultCriticalLevel: number;
  offlineSessionHours: number;
  syncIntervalMinutes: number;
  weeklyReportDay: number;
  weeklyReportHour: number;
  posBarcodeScanningEnabled: boolean;
}

export interface ShopDocument extends BaseDocument {
  businessId: string;
  name: string;
  code: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
  mpesaEnabled?: boolean;
  mpesaStkEnabled?: boolean;
  mpesaPayToTillEnabled?: boolean;
  mpesaTillNumber?: string | null;
  mpesaEnvironment?: string | null;
  mpesaBusinessShortcode?: string | null;
  mpesaPartyB?: string | null;
  mpesaConsumerKeyRef?: string | null;
  mpesaConsumerSecretRef?: string | null;
  mpesaPasskeyRef?: string | null;
  mpesaStkCallbackUrl?: string | null;
  mpesaC2bConfirmationUrl?: string | null;
  mpesaC2bValidationUrl?: string | null;
  mpesaStatusResultUrl?: string | null;
  mpesaStatusTimeoutUrl?: string | null;
}

export interface UserDocument extends BaseDocument {
  businessId: string;
  shopId?: string | null;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: AccountStatus;
  passwordVersion: number;
  failedLoginAttempts: number;
  lockedUntil?: Date | null;
  lastLoginAt?: Date | null;
  createdById?: string | null;
}

export interface SalespersonProfileDocument extends BaseDocument {
  shopId: string;
  name: string;
  pinHash: string;
  code: string;
  isActive: boolean;
}

export interface CategoryDocument extends BaseDocument {
  businessId: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface BrandDocument extends BaseDocument {
  businessId: string;
  name: string;
  isActive: boolean;
}

export interface UnitDocument extends BaseDocument {
  businessId: string;
  name: string;
  symbol: string;
}

export interface ProductDocument extends BaseDocument {
  businessId: string;
  categoryId?: string | null;
  brandId?: string | null;
  unitId?: string | null;
  name: string;
  sku: string;
  barcode?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  defaultCostPrice: number;
  defaultSellingPrice: number;
  taxRate: number;
  trackStock: boolean;
  status: ProductStatus;
}

export interface ProductPricingUnitDocument extends BaseDocument {
  productId: string;
  unitId: string;
  costPrice: number;
  sellingPrice: number;
  multiplier?: number;
}

export interface ShopInventoryDocument extends BaseDocument {
  shopId: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
  reorderLevel: number;
  criticalLevel: number;
  reorderQuantity: number;
  costPrice: number;
  sellingPrice: number;
  isAvailable: boolean;
  shelfLocation?: string | null;
  lastStockedAt?: Date | null;
  lastSoldAt?: Date | null;
  version: number;
}

export interface SupplierDocument extends BaseDocument {
  businessId: string;
  shopId: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  alternativePhone?: string | null;
  address?: string | null;
  notes?: string | null;
  status: "ACTIVE" | "DISABLED";
}

export interface SupplierProductDocument extends BaseDocument {
  supplierId: string;
  shopId: string;
  productId: string;
  targetQuantity: number;
  preferredUnit?: string | null;
  lastNotificationAt?: Date | null;
  lastNotifiedQuantity?: number | null;
  lastNotifiedStatus?: string | null;
}

export interface SupplierNotificationHistoryDocument extends BaseDocument {
  businessId: string;
  shopId: string;
  supplierId: string;
  referenceNumber: string;
  status: "PENDING" | "SENT" | "FAILED";
  notificationType: "RESTOCK_REQUEST" | "TEST_EMAIL";
  productCount: number;
  emailAddress: string;
  subject: string;
  pdfUrl?: string | null;
  sentAt?: Date | null;
  failedAt?: Date | null;
  failureReason?: string | null;
}

export interface RegisterDocument extends BaseDocument {
  shopId: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface RegisterSessionDocument extends BaseDocument {
  shopId: string;
  registerId: string;
  salespersonId?: string | null;
  status: RegisterSessionStatus;
  openingCash: number;
  expectedCash?: number | null;
  actualCash?: number | null;
  variance?: number | null;
  openingNote?: string | null;
  closingNote?: string | null;
  openedAt: Date;
  closedAt?: Date | null;
  localReference?: string | null;
  idempotencyKey?: string | null;
  enabledPaymentChannels?: string[] | null;
  openingCashSource?: string | null;
  openingMpesaBalance?: number | null;
  openingMpesaBalanceMethod?: string | null;
  openingMpesaVerifiedBy?: string | null;
  openingMpesaVerifiedAt?: Date | null;
  openingMpesaReference?: string | null;
  expectedClosingMpesaBalance?: number | null;
  actualClosingMpesaBalance?: number | null;
  closingMpesaBalanceMethod?: string | null;
  closingMpesaVerifiedBy?: string | null;
  closingMpesaVerifiedAt?: Date | null;
  closingMpesaReference?: string | null;
  mpesaVariance?: number | null;
  mpesaVarianceStatus?: string | null;
  mpesaVarianceReason?: string | null;
  unresolvedPaymentCount?: number | null;
  closedWithUnresolvedPayments?: boolean | null;
  unresolvedClosureReason?: string | null;
  approvedBy?: string | null;
}

export interface RegisterTransactionDocument extends BaseDocument {
  registerSessionId: string;
  type: string;
  source?: "CASH" | "MPESA" | null;
  amount: number;
  note?: string | null;
}

export interface SaleDocument extends BaseDocument {
  shopId: string;
  registerSessionId?: string | null;
  salespersonId?: string | null;
  receiptNumber: string;
  clientReference?: string | null;
  status: SaleStatus;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  changeDue: number;
  customerName?: string | null;
  note?: string | null;
  isOffline: boolean;
  occurredAt: Date;
  syncedAt?: Date | null;
}

export interface SaleItemDocument extends BaseDocument {
  saleId: string;
  productId: string;
  productName: string;
  sku: string;
  unitId?: string | null;
  unitName?: string | null;
  unitSymbol?: string | null;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  discountTotal: number;
  taxTotal: number;
  lineTotal: number;
}

export interface PaymentDocument extends BaseDocument {
  saleId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  reference?: string | null;
}

export type MpesaPaymentMode = "STK_PUSH" | "PAY_TO_TILL";
export type MpesaPaymentStatus = "PENDING" | "WAITING_FOR_CUSTOMER" | "SENDING_REQUEST" | "REQUEST_SENT" | "RECEIVED" | "MATCHING" | "MATCHED" | "SUCCESSFUL" | "FAILED" | "CANCELLED" | "TIMED_OUT" | "UNDERPAID" | "OVERPAID" | "AMBIGUOUS" | "UNMATCHED" | "REVERSED" | "CONFIRMATION_DELAYED" | "CHECKING_PAYMENT_STATUS" | "READY";
export type MpesaMatchStatus = "PENDING" | "MATCHED" | "AMBIGUOUS" | "UNMATCHED" | "REVERSED";

export interface MpesaPaymentDocument extends BaseDocument {
  shopId: string;
  saleId: string;
  cashierId?: string | null;
  shiftId?: string | null;
  customerId?: string | null;
  mode: MpesaPaymentMode;
  status: MpesaPaymentStatus;
  matchStatus: MpesaMatchStatus;
  expectedAmountMinor: number;
  receivedAmountMinor: number;
  customerPhone?: string | null;
  tillNumber?: string | null;
  shortcode?: string | null;
  internalReference: string;
  clientReference?: string | null;
  idempotencyKey: string;
  merchantRequestId?: string | null;
  checkoutRequestId?: string | null;
  transactionId?: string | null;
  receiptNumber?: string | null;
  resultCode?: string | null;
  resultDescription?: string | null;
  callbackPayload?: Record<string, unknown> | null;
  expiryAt: Date;
  receivedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MpesaCallbackEventDocument extends BaseDocument {
  shopId: string;
  transactionId: string;
  transactionType?: string | null;
  transactionTime?: string | null;
  transactionAmount?: string | null;
  businessShortCode?: string | null;
  tillNumber?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  billReference?: string | null;
  invoiceNumber?: string | null;
  organizationBalance?: string | null;
  callbackPayload?: Record<string, unknown> | null;
  processingStatus: "PENDING" | "PROCESSED" | "DUPLICATE" | "FAILED";
  matchedPaymentId?: string | null;
  matchedSaleId?: string | null;
  createdAt: Date;
  processedAt?: Date | null;
}

export interface StockMovementDocument extends BaseDocument {
  shopId: string;
  productId: string;
  type: StockMovementType;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
}

export interface StockTransferDocument extends BaseDocument {
  transferNumber: string;
  sourceShopId: string;
  destinationShopId: string;
  status: TransferStatus;
  note?: string | null;
  dispatchedAt?: Date | null;
  receivedAt?: Date | null;
}

export interface StockTransferItemDocument extends BaseDocument {
  transferId: string;
  productId: string;
  requestedQuantity: number;
  dispatchedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
}

export interface InventoryAlertDocument extends BaseDocument {
  shopId: string;
  productId: string;
  type: InventoryAlertType;
  status: AlertStatus;
  currentQuantity: number;
  thresholdQuantity: number;
  firstTriggeredAt: Date;
  lastTriggeredAt: Date;
  acknowledgedAt?: Date | null;
  resolvedAt?: Date | null;
}

export interface InventoryReportDocument extends BaseDocument {
  businessId: string;
  periodStart: Date;
  periodEnd: Date;
  status: ReportStatus;
  totalStockQuantity: number;
  totalCostValue: number;
  totalSellingValue: number;
  lowStockCount: number;
  criticalStockCount: number;
  outOfStockCount: number;
  generatedAt?: Date | null;
  errorMessage?: string | null;
}

export interface InventoryReportItemDocument extends BaseDocument {
  reportId: string;
  shopId: string;
  productId: string;
  openingQuantity: number;
  quantityAdded: number;
  quantitySold: number;
  quantityTransferredIn: number;
  quantityTransferredOut: number;
  quantityDamaged: number;
  closingQuantity: number;
  reorderLevel: number;
  criticalLevel: number;
  stockStatus: string;
  averageDailySales: number;
  estimatedDaysRemaining?: number | null;
  costValue: number;
  sellingValue: number;
}

export interface RefundRequestDocument extends BaseDocument {
  saleId: string;
  shopId: string;
  reason: string;
  requestType: "FULL_SALE" | "SELECTED_PRODUCTS" | "EXCHANGE";
  refundMethod: "CASH" | "MPESA" | "CARD" | "BANK_TRANSFER" | "MIXED";
  selectedItemIds?: string[];
  restockReturnedProducts: boolean;
  markItemsAsDamaged: boolean;
  requestManagerApproval: boolean;
  status: RefundStatus;
  requestedAt: Date;
  reviewedAt?: Date | null;
  reviewNote?: string | null;
}

export interface RefundDocument extends BaseDocument {
  saleId: string;
  refundNumber: string;
  status: RefundStatus;
  total: number;
  reason: string;
}

export interface RefundItemDocument extends BaseDocument {
  refundId: string;
  productId: string;
  quantity: number;
  amount: number;
  restock: boolean;
}

export interface ExpenseCategoryDocument extends BaseDocument {
  businessId: string;
  name: string;
  isActive: boolean;
}

export interface ExpenseDocument extends BaseDocument {
  shopId: string;
  categoryId: string;
  source: "CASH" | "MPESA";
  amount: number;
  description: string;
  status: ExpenseStatus;
  receiptUrl?: string | null;
  occurredAt: Date;
}

export interface NotificationDocument extends BaseDocument {
  userId?: string | null;
  shopId?: string | null;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  actionUrl?: string | null;
  isRead: boolean;
  readAt?: Date | null;
}

export interface NotificationPreferenceDocument extends BaseDocument {
  businessId: string;
  lowStockInApp: boolean;
  lowStockPush: boolean;
  lowStockEmail: boolean;
  criticalInApp: boolean;
  criticalPush: boolean;
  criticalEmail: boolean;
  outOfStockInApp: boolean;
  outOfStockPush: boolean;
  outOfStockEmail: boolean;
  weeklyReportInApp: boolean;
  weeklyReportPush: boolean;
  weeklyReportEmail: boolean;
}

export interface EmailQueueDocument extends BaseDocument {
  recipient: string;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  type: string;
  status: QueueStatus;
  attempts: number;
  maximumAttempts: number;
  lastError?: string | null;
  scheduledFor: Date;
  sentAt?: Date | null;
}

export interface PushSubscriptionDocument extends BaseDocument {
  userId: string;
  endpointHash: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
  deviceName?: string | null;
  isActive: boolean;
  lastUsedAt?: Date | null;
  failureCount: number;
}

export interface PushNotificationQueueDocument extends BaseDocument {
  userId: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  tag?: string | null;
  status: QueueStatus;
  attempts: number;
  maximumAttempts: number;
  lastError?: string | null;
  scheduledFor: Date;
  sentAt?: Date | null;
}

export interface OfflineDeviceDocument extends BaseDocument {
  shopId: string;
  name: string;
  platform?: string | null;
  userAgent?: string | null;
  isTrusted: boolean;
  isActive: boolean;
  lastSeenAt: Date;
  lastSyncAt?: Date | null;
  offlineAccessExpiresAt: Date;
}

export interface OfflineSyncBatchDocument extends BaseDocument {
  shopId: string;
  deviceId: string;
  status: SyncBatchStatus;
  recordCount: number;
  successCount: number;
  conflictCount: number;
  errorCount: number;
  startedAt: Date;
  completedAt?: Date | null;
  errorSummary?: string | null;
}

export interface OfflineSyncConflictDocument extends BaseDocument {
  shopId: string;
  deviceId: string;
  batchId?: string | null;
  type: ConflictType;
  status: ConflictStatus;
  entityType: string;
  entityReference: string;
  details: Record<string, unknown>;
  resolvedAt?: Date | null;
}

export interface IdempotencyRecordDocument extends BaseDocument {
  key: string;
  shopId: string;
  operation: string;
  responseData?: Record<string, unknown> | null;
  processedAt: Date;
  expiresAt?: Date | null;
}

export interface AuditLogDocument extends BaseDocument {
  userId?: string | null;
  shopId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  description: string;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface SystemSettingDocument extends BaseDocument {
  key: string;
  value: Record<string, unknown>;
}

export interface ScheduledJobLogDocument extends BaseDocument {
  jobType: string;
  status: string;
  recordsProcessed: number;
  recordsFailed: number;
  errorSummary?: string | null;
  startedAt: Date;
  completedAt?: Date | null;
}

export type DefaultValue = unknown | (() => unknown);
export type TimestampMode = "both" | "created" | "updated" | false;

export type MongoModelDefinition<TDocument extends BaseDocument = BaseDocument> = {
  collection: string;
  required?: Array<keyof TDocument & string>;
  defaults?: Partial<Record<keyof TDocument & string, DefaultValue>>;
  enums?: Partial<Record<keyof TDocument & string, readonly string[]>>;
  indexes?: IndexDescription[];
  timestamps?: TimestampMode;
  readonly documentType?: TDocument;
};
