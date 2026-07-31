import { endOfDay, startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { generateInventoryReport, previousWeekRange } from "@/lib/reports/weekly-inventory";
import { getStockStatus } from "@/lib/utils";

type InventoryWithRelations = {
  id: string;
  shopId: string;
  productId: string;
  quantity: number;
  costPrice: number | string;
  sellingPrice: number | string;
  reorderLevel: number;
  criticalLevel: number;
  shop?: { id: string; name: string } | null;
  product?: { id: string; name: string; sku: string; categoryId?: string | null } | null;
};

type InventoryWithStatus = InventoryWithRelations & { stockStatus: "IN_STOCK" | "LOW_STOCK" | "CRITICAL" | "OUT_OF_STOCK" };

export async function listInventoryReports(businessId: string) {
  const [business, reports] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.inventoryReport.findMany({ where: { businessId }, orderBy: { periodEnd: "desc" } }),
  ]);
  return { business, reports };
}

export async function getInventoryReportDetail(businessId: string, reportId: string) {
  return db.inventoryReport.findFirst({
    where: { id: reportId, businessId },
    include: {
      business: true,
      items: { include: { shop: true, product: true }, orderBy: [{ stockStatus: "asc" }, { shop: { name: "asc" } }] },
    },
  });
}

export async function generateInventoryReportNow(businessId: string) {
  const { periodStart, periodEnd } = previousWeekRange();
  return generateInventoryReport(businessId, periodStart, periodEnd);
}

export async function getAdminReportsOverview(businessId: string) {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const [business, reports, shops, inventory, sales] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.inventoryReport.findMany({ where: { businessId }, orderBy: { periodEnd: "desc" }, take: 10 }),
    db.shop.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } }),
    db.shopInventory.findMany({ where: { shop: { businessId } }, include: { shop: true, product: true } }),
    db.sale.findMany({
      where: { shop: { businessId }, occurredAt: { gte: todayStart, lte: todayEnd }, status: "COMPLETED" },
      include: { shop: true },
    }),
  ]);

  const inventoryStatuses = inventory.map((entry) => ({
    ...(entry as InventoryWithRelations),
    stockStatus: getStockStatus(entry.quantity, entry.reorderLevel, entry.criticalLevel),
  })) as InventoryWithStatus[];

  const lowStockCount = inventoryStatuses.filter((entry) => entry.stockStatus === "LOW_STOCK").length;
  const criticalStockCount = inventoryStatuses.filter((entry) => entry.stockStatus === "CRITICAL").length;
  const outOfStockCount = inventoryStatuses.filter((entry) => entry.stockStatus === "OUT_OF_STOCK").length;
  const healthyStockCount = inventoryStatuses.filter((entry) => entry.stockStatus === "IN_STOCK").length;
  const totalInventoryValue = inventory.reduce((sum, entry) => sum + Number(entry.costPrice) * entry.quantity, 0);
  const totalSellingValue = inventory.reduce((sum, entry) => sum + Number(entry.sellingPrice) * entry.quantity, 0);

  const shopSummaries = shops.map((shop) => {
    const shopInventory = inventoryStatuses.filter((entry) => entry.shopId === shop.id);
    const shopLow = shopInventory.filter((entry) => entry.stockStatus === "LOW_STOCK").length;
    const shopCritical = shopInventory.filter((entry) => entry.stockStatus === "CRITICAL").length;
    const shopOut = shopInventory.filter((entry) => entry.stockStatus === "OUT_OF_STOCK").length;
    return {
      shop,
      inventoryCount: shopInventory.length,
      inventoryValue: shopInventory.reduce((sum, entry) => sum + Number(entry.costPrice) * entry.quantity, 0),
      lowStockCount: shopLow,
      criticalStockCount: shopCritical,
      outOfStockCount: shopOut,
      alerts: shopLow + shopCritical + shopOut,
    };
  });

  const todaySalesTotal = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const todayTransactions = sales.length;

  return {
    business,
    reports,
    shopSummaries,
    stockHealth: {
      totalRecords: inventory.length,
      healthy: healthyStockCount,
      low: lowStockCount,
      critical: criticalStockCount,
      out: outOfStockCount,
      costValue: totalInventoryValue,
      sellingValue: totalSellingValue,
    },
    latestReport: reports[0] ?? null,
    dailySales: {
      total: todaySalesTotal,
      transactions: todayTransactions,
    },
    weeklySchedule: {
      day: business.weeklyReportDay,
      hour: business.weeklyReportHour,
    },
  };
}

export async function getStockIntelligenceData(businessId: string) {
  const [business, inventory, shops, categories, reports, reportItems, movements] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.shopInventory.findMany({ where: { shop: { businessId } }, include: { shop: true, product: true } }),
    db.shop.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } }),
    db.category.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } }),
    db.inventoryReport.findMany({ where: { businessId }, orderBy: { periodEnd: "asc" }, take: 90 }),
    db.inventoryReportItem.findMany({ where: { report: { businessId } }, orderBy: { reportId: "asc" } }),
    db.stockMovement.findMany({ where: { shop: { businessId } }, orderBy: { createdAt: "asc" }, take: 180 }),
  ]);

  const inventoryStatuses = inventory.map((entry) => ({
    ...(entry as InventoryWithRelations),
    stockStatus: getStockStatus(entry.quantity, entry.reorderLevel, entry.criticalLevel),
  })) as InventoryWithStatus[];

  const productCategoryMap = new Map<string, string | null>(
    inventoryStatuses.map((entry) => [entry.productId, entry.product?.categoryId ?? null]),
  );

  const history = reports.map((report) => {
    const rows = reportItems.filter((item) => item.reportId === report.id);
    const low = rows.filter((item) => item.stockStatus === "LOW_STOCK").length;
    const critical = rows.filter((item) => item.stockStatus === "CRITICAL").length;
    const out = rows.filter((item) => item.stockStatus === "OUT_OF_STOCK").length;
    return {
      label: report.periodEnd.toLocaleDateString("en-KE"),
      low,
      critical,
      out,
    };
  });

  const movementTrend = movements.reduce<Record<string, { label: string; received: number; sold: number; transferred: number; adjusted: number }>>((accumulator, entry) => {
    const createdAt = entry.createdAt ? new Date(entry.createdAt) : new Date();
    const label = createdAt.toLocaleDateString("en-KE");
    const existing = accumulator[label] ?? { label, received: 0, sold: 0, transferred: 0, adjusted: 0 };
    const type = String(entry.type || "").toUpperCase();
    const quantity = Math.abs(Number(entry.quantityChange || 0));
    if (type === "SALE") existing.sold += quantity;
    else if (type === "TRANSFER_OUT" || type === "TRANSFER_IN") existing.transferred += quantity;
    else if (type === "PURCHASE_RECEIPT" || type === "OPENING_STOCK") existing.received += quantity;
    else existing.adjusted += quantity;
    accumulator[label] = existing;
    return accumulator;
  }, {});

  const shopSummaries = shops.map((shop) => {
    const shopInventory = inventoryStatuses.filter((entry) => entry.shopId === shop.id);
    return {
      shop,
      totalProducts: shopInventory.length,
      totalValue: shopInventory.reduce((sum, entry) => sum + Number(entry.costPrice) * entry.quantity, 0),
      lowStockCount: shopInventory.filter((entry) => entry.stockStatus === "LOW_STOCK").length,
      criticalStockCount: shopInventory.filter((entry) => entry.stockStatus === "CRITICAL").length,
      outOfStockCount: shopInventory.filter((entry) => entry.stockStatus === "OUT_OF_STOCK").length,
    };
  });

  const topRiskProducts = inventoryStatuses
    .filter((entry) => entry.stockStatus !== "IN_STOCK")
    .sort((left, right) => {
      const priority = { OUT_OF_STOCK: 0, CRITICAL: 1, LOW_STOCK: 2, IN_STOCK: 3 } as const;
      const diff = priority[left.stockStatus] - priority[right.stockStatus];
      if (diff !== 0) return diff;
      return left.quantity - right.quantity;
    })
    .slice(0, 12)
    .map((entry) => ({
      id: entry.id,
      product: entry.product?.name ?? "Unknown",
      sku: entry.product?.sku ?? "",
      shop: entry.shop?.name ?? "Unknown",
      quantity: entry.quantity,
      reorderLevel: entry.reorderLevel,
      criticalLevel: entry.criticalLevel,
      stockStatus: entry.stockStatus,
      value: Number(entry.costPrice) * entry.quantity,
    }));

  return {
    business,
    inventory: inventoryStatuses,
    shops,
    categories,
    shopSummaries,
    topRiskProducts,
    history,
    movementTrend,
    stockHealth: {
      totalRecords: inventoryStatuses.length,
      low: inventoryStatuses.filter((entry) => entry.stockStatus === "LOW_STOCK").length,
      critical: inventoryStatuses.filter((entry) => entry.stockStatus === "CRITICAL").length,
      out: inventoryStatuses.filter((entry) => entry.stockStatus === "OUT_OF_STOCK").length,
    },
  };
}

export async function getDailySnapshotData(businessId: string) {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const [business, inventory, sales] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.shopInventory.findMany({ where: { shop: { businessId } }, include: { shop: true, product: true } }),
    db.sale.findMany({
      where: { shop: { businessId }, occurredAt: { gte: todayStart, lte: todayEnd }, status: "COMPLETED" },
      include: { shop: true, _count: { select: { items: true } } },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  const inventoryStatuses = inventory.map((entry) => ({
    ...(entry as InventoryWithRelations),
    stockStatus: getStockStatus(entry.quantity, entry.reorderLevel, entry.criticalLevel),
  })) as InventoryWithStatus[];

  const lowStockCount = inventoryStatuses.filter((entry) => entry.stockStatus === "LOW_STOCK").length;
  const criticalStockCount = inventoryStatuses.filter((entry) => entry.stockStatus === "CRITICAL").length;
  const outOfStockCount = inventoryStatuses.filter((entry) => entry.stockStatus === "OUT_OF_STOCK").length;
  const healthyStockCount = inventoryStatuses.filter((entry) => entry.stockStatus === "IN_STOCK").length;
  const totalInventoryValue = inventoryStatuses.reduce((sum, entry) => sum + Number(entry.costPrice) * entry.quantity, 0);

  const shopSummaries = Array.from(new Map(inventoryStatuses.map((entry) => [entry.shopId, entry])).values()).map((entry) => {
    const shopInventory = inventoryStatuses.filter((item) => item.shopId === entry.shopId);
    return {
      shop: entry.shop,
      inventoryCount: shopInventory.length,
      lowStockCount: shopInventory.filter((item) => item.stockStatus === "LOW_STOCK").length,
      criticalStockCount: shopInventory.filter((item) => item.stockStatus === "CRITICAL").length,
      outOfStockCount: shopInventory.filter((item) => item.stockStatus === "OUT_OF_STOCK").length,
      inventoryValue: shopInventory.reduce((sum, item) => sum + Number(item.costPrice) * item.quantity, 0),
    };
  });

  const todaySalesTotal = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const todayTransactions = sales.length;

  const topRiskProducts = inventoryStatuses
    .filter((entry) => entry.stockStatus !== "IN_STOCK")
    .sort((left, right) => {
      const priority = { OUT_OF_STOCK: 0, CRITICAL: 1, LOW_STOCK: 2, IN_STOCK: 3 } as const;
      const diff = priority[left.stockStatus] - priority[right.stockStatus];
      if (diff !== 0) return diff;
      return left.quantity - right.quantity;
    })
    .slice(0, 10)
    .map((entry) => ({
      id: entry.id,
      product: entry.product?.name ?? "Unknown",
      sku: entry.product?.sku ?? "",
      shop: entry.shop?.name ?? "Unknown",
      quantity: entry.quantity,
      stockStatus: entry.stockStatus,
      value: Number(entry.costPrice) * entry.quantity,
    }));

  return {
    business,
    stockHealth: {
      totalRecords: inventoryStatuses.length,
      healthy: healthyStockCount,
      low: lowStockCount,
      critical: criticalStockCount,
      out: outOfStockCount,
      costValue: totalInventoryValue,
    },
    shopSummaries,
    dailySales: {
      total: todaySalesTotal,
      transactions: todayTransactions,
    },
    topRiskProducts,
  };
}
