export type RelationDefinition = {
  target: string;
  localField: string;
  foreignField: string;
  many: boolean;
};

const relation = (
  target: string,
  localField: string,
  foreignField: string,
  many = false,
): RelationDefinition => ({ target, localField, foreignField, many });

export const modelRelations: Record<string, Record<string, RelationDefinition>> = {
  business: {
    shops: relation("shop", "id", "businessId", true),
    users: relation("user", "id", "businessId", true),
    categories: relation("category", "id", "businessId", true),
    brands: relation("brand", "id", "businessId", true),
    units: relation("unit", "id", "businessId", true),
    products: relation("product", "id", "businessId", true),
    inventoryReports: relation("inventoryReport", "id", "businessId", true),
    notificationPreference: relation("notificationPreference", "id", "businessId"),
    expenseCategories: relation("expenseCategory", "id", "businessId", true),
  },
  shop: {
    business: relation("business", "businessId", "id"),
    account: relation("user", "id", "shopId"),
    salespeople: relation("salespersonProfile", "id", "shopId", true),
    inventory: relation("shopInventory", "id", "shopId", true),
    sales: relation("sale", "id", "shopId", true),
    registers: relation("register", "id", "shopId", true),
    registerSessions: relation("registerSession", "id", "shopId", true),
    stockMovements: relation("stockMovement", "id", "shopId", true),
    outgoingTransfers: relation("stockTransfer", "id", "sourceShopId", true),
    incomingTransfers: relation("stockTransfer", "id", "destinationShopId", true),
    inventoryAlerts: relation("inventoryAlert", "id", "shopId", true),
    expenses: relation("expense", "id", "shopId", true),
    devices: relation("offlineDevice", "id", "shopId", true),
    syncBatches: relation("offlineSyncBatch", "id", "shopId", true),
    conflicts: relation("offlineSyncConflict", "id", "shopId", true),
    notifications: relation("notification", "id", "shopId", true),
    auditLogs: relation("auditLog", "id", "shopId", true),
    idempotency: relation("idempotencyRecord", "id", "shopId", true),
    reportItems: relation("inventoryReportItem", "id", "shopId", true),
    refundRequests: relation("refundRequest", "id", "shopId", true),
  },
  user: {
    business: relation("business", "businessId", "id"),
    shop: relation("shop", "shopId", "id"),
    createdBy: relation("user", "createdById", "id"),
    createdUsers: relation("user", "id", "createdById", true),
    pushSubscriptions: relation("pushSubscription", "id", "userId", true),
    notifications: relation("notification", "id", "userId", true),
    auditLogs: relation("auditLog", "id", "userId", true),
  },
  salespersonProfile: {
    shop: relation("shop", "shopId", "id"),
    sales: relation("sale", "id", "salespersonId", true),
    sessions: relation("registerSession", "id", "salespersonId", true),
  },
  category: {
    business: relation("business", "businessId", "id"),
    products: relation("product", "id", "categoryId", true),
  },
  brand: {
    business: relation("business", "businessId", "id"),
    products: relation("product", "id", "brandId", true),
  },
  unit: {
    business: relation("business", "businessId", "id"),
    products: relation("product", "id", "unitId", true),
  },
  product: {
    business: relation("business", "businessId", "id"),
    category: relation("category", "categoryId", "id"),
    brand: relation("brand", "brandId", "id"),
    unit: relation("unit", "unitId", "id"),
    inventory: relation("shopInventory", "id", "productId", true),
    saleItems: relation("saleItem", "id", "productId", true),
    stockMovements: relation("stockMovement", "id", "productId", true),
    transferItems: relation("stockTransferItem", "id", "productId", true),
    inventoryAlerts: relation("inventoryAlert", "id", "productId", true),
    reportItems: relation("inventoryReportItem", "id", "productId", true),
    refundItems: relation("refundItem", "id", "productId", true),
  },
  shopInventory: {
    shop: relation("shop", "shopId", "id"),
    product: relation("product", "productId", "id"),
  },
  register: {
    shop: relation("shop", "shopId", "id"),
    sessions: relation("registerSession", "id", "registerId", true),
  },
  registerSession: {
    shop: relation("shop", "shopId", "id"),
    register: relation("register", "registerId", "id"),
    salesperson: relation("salespersonProfile", "salespersonId", "id"),
    sales: relation("sale", "id", "registerSessionId", true),
    transactions: relation("registerTransaction", "id", "registerSessionId", true),
  },
  registerTransaction: {
    registerSession: relation("registerSession", "registerSessionId", "id"),
  },
  sale: {
    shop: relation("shop", "shopId", "id"),
    registerSession: relation("registerSession", "registerSessionId", "id"),
    salesperson: relation("salespersonProfile", "salespersonId", "id"),
    items: relation("saleItem", "id", "saleId", true),
    payments: relation("payment", "id", "saleId", true),
    refundRequests: relation("refundRequest", "id", "saleId", true),
    refunds: relation("refund", "id", "saleId", true),
  },
  saleItem: {
    sale: relation("sale", "saleId", "id"),
    product: relation("product", "productId", "id"),
  },
  payment: { sale: relation("sale", "saleId", "id") },
  stockMovement: {
    shop: relation("shop", "shopId", "id"),
    product: relation("product", "productId", "id"),
  },
  stockTransfer: {
    sourceShop: relation("shop", "sourceShopId", "id"),
    destinationShop: relation("shop", "destinationShopId", "id"),
    items: relation("stockTransferItem", "id", "transferId", true),
  },
  stockTransferItem: {
    transfer: relation("stockTransfer", "transferId", "id"),
    product: relation("product", "productId", "id"),
  },
  inventoryAlert: {
    shop: relation("shop", "shopId", "id"),
    product: relation("product", "productId", "id"),
  },
  inventoryReport: {
    business: relation("business", "businessId", "id"),
    items: relation("inventoryReportItem", "id", "reportId", true),
  },
  inventoryReportItem: {
    report: relation("inventoryReport", "reportId", "id"),
    shop: relation("shop", "shopId", "id"),
    product: relation("product", "productId", "id"),
  },
  refundRequest: {
    sale: relation("sale", "saleId", "id"),
    shop: relation("shop", "shopId", "id"),
  },
  refund: {
    sale: relation("sale", "saleId", "id"),
    items: relation("refundItem", "id", "refundId", true),
  },
  refundItem: {
    refund: relation("refund", "refundId", "id"),
    product: relation("product", "productId", "id"),
  },
  expenseCategory: {
    business: relation("business", "businessId", "id"),
    expenses: relation("expense", "id", "categoryId", true),
  },
  expense: {
    shop: relation("shop", "shopId", "id"),
    category: relation("expenseCategory", "categoryId", "id"),
  },
  notification: {
    user: relation("user", "userId", "id"),
    shop: relation("shop", "shopId", "id"),
  },
  notificationPreference: {
    business: relation("business", "businessId", "id"),
  },
  pushSubscription: {
    user: relation("user", "userId", "id"),
  },
  offlineDevice: {
    shop: relation("shop", "shopId", "id"),
    syncBatches: relation("offlineSyncBatch", "id", "deviceId", true),
    conflicts: relation("offlineSyncConflict", "id", "deviceId", true),
  },
  offlineSyncBatch: {
    shop: relation("shop", "shopId", "id"),
    device: relation("offlineDevice", "deviceId", "id"),
  },
  offlineSyncConflict: {
    shop: relation("shop", "shopId", "id"),
    device: relation("offlineDevice", "deviceId", "id"),
  },
  idempotencyRecord: { shop: relation("shop", "shopId", "id") },
  auditLog: {
    user: relation("user", "userId", "id"),
    shop: relation("shop", "shopId", "id"),
  },
};
