import { endOfDay, startOfDay, subDays } from "date-fns";
import { createElement } from "react";
import { connectToMongoDB } from "@/lib/mongodb";
import { db } from "@/lib/db";
import { buildSnapshotHtml, queueNotification } from "@/lib/notifications/service";
import { getStockStatus } from "@/lib/utils";
import { renderToBuffer } from "@react-pdf/renderer";
import { WeeklyInventoryReportPdf, type WeeklyReportPdfData } from "@/lib/reports/weekly-report-pdf";

export function previousWeekRange(reference = new Date()) {
  const day = reference.getDay() || 7;
  const currentMonday = startOfDay(subDays(reference, day - 1));
  const periodEnd = endOfDay(subDays(currentMonday, 1));
  const periodStart = startOfDay(subDays(periodEnd, 6));
  return { periodStart, periodEnd };
}

export type WeeklyReportSummary = {
  totalSalesCount: number;
  totalRevenue: number;
  totalProfit: number;
  totalExpenses: number;
  totalNet: number;
  shopRankings: Array<{
    shopId: string;
    shopName: string;
    transactions: number;
    sales: number;
    profit: number;
    expenses: number;
    alerts: number;
  }>;
  bestSellersByShop: Array<{
    shopName: string;
    products: Array<{ productName: string; quantity: number; revenue: number }>;
  }>;
  worstSellersAcrossShops: Array<{ productName: string; quantity: number; revenue: number }>;
  stockSummary: Array<{
    shopName: string;
    totalProducts: number;
    lowStockCount: number;
    criticalStockCount: number;
    outOfStockCount: number;
    inventoryValue: number;
  }>;
  stockIntelligenceByShop: Array<{
    shopName: string;
    outOfStock: string[];
    criticalStock: string[];
    lowStock: string[];
    healthyStock: string[];
  }>;
};

export async function loadWeeklyReportSummary(businessId: string, periodStart: Date, periodEnd: Date) {
  const database = await connectToMongoDB();

  const shops = await database
    .collection("shops")
    .find({ businessId, isActive: true }, { projection: { _id: 0, id: 1, name: 1 } })
    .toArray();
  const shopIds = shops.map((shop) => shop.id);

  const [sales, expenses, inventoryRows] = await Promise.all([
    database
      .collection("sales")
      .find({ shopId: { $in: shopIds }, status: "COMPLETED", occurredAt: { $gte: periodStart, $lte: periodEnd } }, { projection: { _id: 0, id: 1, shopId: 1, total: 1 } })
      .toArray(),
    database
      .collection("expenses")
      .find({ shopId: { $in: shopIds }, status: "APPROVED", occurredAt: { $gte: periodStart, $lte: periodEnd } }, { projection: { _id: 0, shopId: 1, amount: 1 } })
      .toArray(),
    database
      .collection("shopInventory")
      .find({ shopId: { $in: shopIds } }, { projection: { _id: 0, shopId: 1, productId: 1, quantity: 1, reorderLevel: 1, criticalLevel: 1, costPrice: 1 } })
      .toArray(),
  ]);

  const productIds = Array.from(new Set(inventoryRows.map((row) => row.productId)));
  const products = productIds.length
    ? await database
        .collection("products")
        .find({ id: { $in: productIds } }, { projection: { _id: 0, id: 1, name: 1 } })
        .toArray()
    : [];
  const productById = new Map(products.map((product) => [product.id, product.name]));

  const saleIds = sales.map((sale) => sale.id);
  const saleItems = saleIds.length
    ? await database
        .collection("saleItems")
        .find({ saleId: { $in: saleIds } }, { projection: { _id: 0, saleId: 1, productName: 1, quantity: 1, unitCost: 1, unitPrice: 1, lineTotal: 1 } })
        .toArray()
    : [];

  const salesById = new Map(sales.map((sale) => [sale.id, sale]));
  const shopSales = new Map<string, { transactions: number; sales: number; profit: number }>();
  const shopExpenses = new Map<string, number>();
  const productTotalsByShop = new Map<string, Map<string, { quantity: number; revenue: number }>>();

  const totalSalesCount = sales.length;
  let totalRevenue = 0;
  let totalProfit = 0;
  let totalExpenses = 0;

  for (const sale of sales) {
    const numericTotal = Number(sale.total) || 0;
    totalRevenue += numericTotal;
    const shopMetrics = shopSales.get(sale.shopId) ?? { transactions: 0, sales: 0, profit: 0 };
    shopMetrics.transactions += 1;
    shopMetrics.sales += numericTotal;
    shopSales.set(sale.shopId, shopMetrics);
  }

  for (const expense of expenses) {
    const amount = Number(expense.amount) || 0;
    totalExpenses += amount;
    shopExpenses.set(expense.shopId, (shopExpenses.get(expense.shopId) ?? 0) + amount);
  }

  for (const item of saleItems) {
    const sale = salesById.get(item.saleId);
    if (!sale) continue;
    const shopId = sale.shopId;
    const unitPrice = Number(item.unitPrice) || 0;
    const unitCost = Number(item.unitCost) || 0;
    const quantity = Number(item.quantity) || 0;
    const revenue = Number(item.lineTotal) || unitPrice * quantity;

    totalProfit += (unitPrice - unitCost) * quantity;
    const shopMetrics = shopSales.get(shopId) ?? { transactions: 0, sales: 0, profit: 0 };
    shopMetrics.profit += (unitPrice - unitCost) * quantity;
    shopSales.set(shopId, shopMetrics);

    const productTotals = productTotalsByShop.get(shopId) ?? new Map();
    const existing = productTotals.get(item.productName) ?? { quantity: 0, revenue: 0 };
    existing.quantity += quantity;
    existing.revenue += revenue;
    productTotals.set(item.productName, existing);
    productTotalsByShop.set(shopId, productTotals);
  }

  const shopSummaryRecords = shops.map((shop) => {
    const inventoryRowsForShop = inventoryRows.filter((row) => row.shopId === shop.id);
    const lowStockCount = inventoryRowsForShop.filter((row) => getStockStatus(row.quantity, row.reorderLevel, row.criticalLevel) === "LOW_STOCK").length;
    const criticalStockCount = inventoryRowsForShop.filter((row) => getStockStatus(row.quantity, row.reorderLevel, row.criticalLevel) === "CRITICAL").length;
    const outOfStockCount = inventoryRowsForShop.filter((row) => getStockStatus(row.quantity, row.reorderLevel, row.criticalLevel) === "OUT_OF_STOCK").length;
    const healthyCount = inventoryRowsForShop.length - lowStockCount - criticalStockCount - outOfStockCount;
    const inventoryValue = inventoryRowsForShop.reduce((sum, row) => sum + Number(row.costPrice) * Number(row.quantity), 0);
    return {
      shop,
      lowStockCount,
      criticalStockCount,
      outOfStockCount,
      healthyCount,
      inventoryValue,
      totalProducts: inventoryRowsForShop.length,
    };
  });

  const stockIntelligenceByShop = shopSummaryRecords.map((summary) => {
    const inventoryRowsForShop = inventoryRows.filter((row) => row.shopId === summary.shop.id);
    const outOfStock = inventoryRowsForShop
      .filter((row) => getStockStatus(row.quantity, row.reorderLevel, row.criticalLevel) === "OUT_OF_STOCK")
      .map((row) => productById.get(row.productId) ?? "Unknown product")
      .slice(0, 6);
    const criticalStock = inventoryRowsForShop
      .filter((row) => getStockStatus(row.quantity, row.reorderLevel, row.criticalLevel) === "CRITICAL")
      .map((row) => row.productName ?? "Unknown product")
      .slice(0, 6);
    const lowStock = inventoryRowsForShop
      .filter((row) => getStockStatus(row.quantity, row.reorderLevel, row.criticalLevel) === "LOW_STOCK")
      .map((row) => row.productName ?? "Unknown product")
      .slice(0, 6);
    const healthyStock = inventoryRowsForShop
      .filter((row) => getStockStatus(row.quantity, row.reorderLevel, row.criticalLevel) === "IN_STOCK")
      .map((row) => row.productName ?? "Unknown product")
      .slice(0, 6);
    return {
      shopName: summary.shop.name,
      outOfStock,
      criticalStock,
      lowStock,
      healthyStock,
    };
  });

  const shopRankings = shops
    .map((shop) => {
      const metrics = shopSales.get(shop.id) ?? { transactions: 0, sales: 0, profit: 0 };
      const stockSummaryForShop = shopSummaryRecords.find((entry) => entry.shop.id === shop.id);
      const lowCount = stockSummaryForShop?.lowStockCount ?? 0;
      const criticalCount = stockSummaryForShop?.criticalStockCount ?? 0;
      const outCount = stockSummaryForShop?.outOfStockCount ?? 0;
      return {
        shopId: shop.id,
        shopName: shop.name,
        transactions: metrics.transactions,
        sales: metrics.sales,
        profit: metrics.profit,
        expenses: shopExpenses.get(shop.id) ?? 0,
        alerts: lowCount + criticalCount + outCount,
      };
    })
    .sort((left, right) => right.sales - left.sales);

  const bestSellersByShop = shops.map((shop) => {
    const productTotals = productTotalsByShop.get(shop.id);
    const products = productTotals
      ? Array.from(productTotals.entries())
          .map(([productName, totals]) => ({ productName, quantity: totals.quantity, revenue: totals.revenue }))
          .sort((left, right) => right.quantity - left.quantity)
          .slice(0, 5)
      : [];
    return {
      shopName: shop.name,
      products,
    };
  });

  const worstSellersAcrossShops = Array.from(
    Array.from(productTotalsByShop.values()).reduce((map, productTotals) => {
      for (const [productName, totals] of productTotals.entries()) {
        const existing = map.get(productName) ?? { quantity: 0, revenue: 0 };
        existing.quantity += totals.quantity;
        existing.revenue += totals.revenue;
        map.set(productName, existing);
      }
      return map;
    }, new Map<string, { quantity: number; revenue: number }>())
      .entries(),
  )
    .map(([productName, totals]) => ({ productName, quantity: totals.quantity, revenue: totals.revenue }))
    .sort((left, right) => left.quantity - right.quantity)
    .slice(0, 5);

  const stockSummary = shopSummaryRecords.map((summary) => ({
    shopName: summary.shop.name,
    totalProducts: summary.totalProducts,
    lowStockCount: summary.lowStockCount,
    criticalStockCount: summary.criticalStockCount,
    outOfStockCount: summary.outOfStockCount,
    inventoryValue: summary.inventoryValue,
  }));

  return {
    totalSalesCount,
    totalRevenue,
    totalProfit,
    totalExpenses,
    totalNet: totalRevenue - totalExpenses,
    shopRankings,
    bestSellersByShop,
    worstSellersAcrossShops,
    stockSummary,
    stockIntelligenceByShop,
  } satisfies WeeklyReportSummary;
}

export async function generateInventoryReport(businessId: string, periodStart: Date, periodEnd: Date) {
  const [business, inventory, movements, admin] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.shopInventory.findMany({ where: { shop: { businessId } }, include: { shop: true, product: true } }),
    db.stockMovement.findMany({ where: { shop: { businessId }, createdAt: { gte: periodStart, lte: periodEnd } } }),
    db.user.findFirstOrThrow({ where: { businessId, role: "ADMIN", status: "ACTIVE" } }),
  ]);

  const movementMap = new Map<string, typeof movements>();
  for (const movement of movements) {
    const key = `${movement.shopId}:${movement.productId}`;
    movementMap.set(key, [...(movementMap.get(key) ?? []), movement]);
  }

  const inventoryRows = inventory.map((entry) => {
    const list = movementMap.get(`${entry.shopId}:${entry.productId}`) ?? [];
    const netChange = list.reduce((sum, movement) => sum + movement.quantityChange, 0);
    const sold = Math.abs(list.filter((movement) => movement.type === "SALE" || movement.type === "OFFLINE_RECONCILIATION").reduce((sum, movement) => sum + Math.min(0, movement.quantityChange), 0));
    const added = list.filter((movement) => movement.type === "PURCHASE_RECEIPT" || movement.type === "OPENING_STOCK").reduce((sum, movement) => sum + Math.max(0, movement.quantityChange), 0);
    const transferredIn = list.filter((movement) => movement.type === "TRANSFER_IN").reduce((sum, movement) => sum + Math.max(0, movement.quantityChange), 0);
    const transferredOut = Math.abs(list.filter((movement) => movement.type === "TRANSFER_OUT").reduce((sum, movement) => sum + Math.min(0, movement.quantityChange), 0));
    const damaged = Math.abs(list.filter((movement) => ["DAMAGE", "EXPIRY", "THEFT"].includes(movement.type)).reduce((sum, movement) => sum + Math.min(0, movement.quantityChange), 0));
    const days = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1);
    const averageDailySales = sold / days;
    const estimatedDaysRemaining = averageDailySales > 0 ? entry.quantity / averageDailySales : null;
    return {
      entry,
      openingQuantity: entry.quantity - netChange,
      quantityAdded: added,
      quantitySold: sold,
      quantityTransferredIn: transferredIn,
      quantityTransferredOut: transferredOut,
      quantityDamaged: damaged,
      stockStatus: getStockStatus(entry.quantity, entry.reorderLevel, entry.criticalLevel),
      averageDailySales,
      estimatedDaysRemaining,
      costValue: Number(entry.costPrice) * entry.quantity,
      sellingValue: Number(entry.sellingPrice) * entry.quantity,
    };
  });

  const lowStockCount = inventoryRows.filter((row) => row.stockStatus === "LOW_STOCK").length;
  const criticalStockCount = inventoryRows.filter((row) => row.stockStatus === "CRITICAL").length;
  const outOfStockCount = inventoryRows.filter((row) => row.stockStatus === "OUT_OF_STOCK").length;
  const report = await db.$transaction(async (tx) => {
    const existing = await tx.inventoryReport.findUnique({ where: { businessId_periodStart_periodEnd: { businessId, periodStart, periodEnd } } });
    if (existing) await tx.inventoryReportItem.deleteMany({ where: { reportId: existing.id } });
    const saved = await tx.inventoryReport.upsert({
      where: { businessId_periodStart_periodEnd: { businessId, periodStart, periodEnd } },
      update: { status: "COMPLETED", totalStockQuantity: inventoryRows.reduce((sum, row) => sum + row.entry.quantity, 0), totalCostValue: inventoryRows.reduce((sum, row) => sum + row.costValue, 0), totalSellingValue: inventoryRows.reduce((sum, row) => sum + row.sellingValue, 0), lowStockCount, criticalStockCount, outOfStockCount, generatedAt: new Date(), errorMessage: null },
      create: { businessId, periodStart, periodEnd, status: "COMPLETED", totalStockQuantity: inventoryRows.reduce((sum, row) => sum + row.entry.quantity, 0), totalCostValue: inventoryRows.reduce((sum, row) => sum + row.costValue, 0), totalSellingValue: inventoryRows.reduce((sum, row) => sum + row.sellingValue, 0), lowStockCount, criticalStockCount, outOfStockCount, generatedAt: new Date() },
    });
    if (inventoryRows.length) await tx.inventoryReportItem.createMany({ data: inventoryRows.map((row) => ({ reportId: saved.id, shopId: row.entry.shopId, productId: row.entry.productId, openingQuantity: row.openingQuantity, quantityAdded: row.quantityAdded, quantitySold: row.quantitySold, quantityTransferredIn: row.quantityTransferredIn, quantityTransferredOut: row.quantityTransferredOut, quantityDamaged: row.quantityDamaged, closingQuantity: row.entry.quantity, reorderLevel: row.entry.reorderLevel, criticalLevel: row.entry.criticalLevel, stockStatus: row.stockStatus, averageDailySales: row.averageDailySales, estimatedDaysRemaining: row.estimatedDaysRemaining, costValue: row.costValue, sellingValue: row.sellingValue })) });
    return saved;
  });

  const preferences = await db.notificationPreference.findUnique({ where: { businessId } });
  const inAppEnabled = preferences?.weeklyReportInApp ?? true;
  const pushEnabled = preferences?.weeklyReportPush ?? true;
  const emailEnabled = preferences?.weeklyReportEmail ?? true;
  const summaryRows = [
    { label: "Low stock", value: String(lowStockCount), description: "Products near threshold", tone: "amber" as const },
    { label: "Critical", value: String(criticalStockCount), description: "Reorder immediately", tone: "red" as const },
    { label: "Out of stock", value: String(outOfStockCount), description: "No inventory left", tone: "red" as const },
  ];
  const html = buildSnapshotHtml(`${business.name} weekly inventory summary`, summaryRows, `${periodStart.toLocaleDateString("en-KE")} to ${periodEnd.toLocaleDateString("en-KE")}`);

  if (!inAppEnabled && !pushEnabled && !emailEnabled) return report;

  const emailPayload: { to: string; subject: string; html: string; attachments?: Array<{ filename: string; contentType: string; content: string }> } | undefined =
    emailEnabled && (process.env.ADMIN_EMAIL ?? admin.email)
      ? { to: process.env.ADMIN_EMAIL ?? admin.email, subject: `Weekly inventory snapshot: ${periodStart.toLocaleDateString("en-KE")} – ${periodEnd.toLocaleDateString("en-KE")}`, html }
      : undefined;

  if (emailPayload) {
    const summary = await loadWeeklyReportSummary(businessId, periodStart, periodEnd);
    const pdfData: WeeklyReportPdfData = {
      businessName: business.name,
      currency: business.currency,
      periodTitle: `${periodStart.toLocaleDateString("en-KE")} – ${periodEnd.toLocaleDateString("en-KE")}`,
      generatedAt: new Date().toLocaleString("en-KE"),
      totalSalesCount: summary.totalSalesCount,
      totalRevenue: summary.totalRevenue,
      totalProfit: summary.totalProfit,
      totalExpenses: summary.totalExpenses,
      totalNet: summary.totalNet,
      shopRankings: summary.shopRankings,
      bestSellersByShop: summary.bestSellersByShop,
      worstSellersAcrossShops: summary.worstSellersAcrossShops,
      stockSummary: summary.stockSummary,
      stockIntelligenceByShop: summary.stockIntelligenceByShop,
    };
    const pdfBuffer = await renderToBuffer(createElement(WeeklyInventoryReportPdf, { report: pdfData }) as Parameters<typeof renderToBuffer>[0]);
    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");
    emailPayload.attachments = [
      {
        filename: `weekly-inventory-${periodStart.toISOString().slice(0, 10)}.pdf`,
        contentType: "application/pdf",
        content: pdfBase64,
      },
    ];
  }

  await queueNotification({
    businessId,
    userId: admin.id,
    type: "WEEKLY_REPORT",
    title: "Weekly inventory report is ready",
    message: `${business.name}: ${lowStockCount} low, ${criticalStockCount} critical and ${outOfStockCount} out-of-stock product records require review.`,
    actionUrl: `/admin/reports/inventory/${report.id}`,
    inApp: inAppEnabled,
    push: pushEnabled,
    email: emailPayload,
  });
  return report;
}
