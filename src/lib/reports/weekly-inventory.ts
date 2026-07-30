import { endOfDay, startOfDay, subDays } from "date-fns";
import { db } from "@/lib/db";
import { getStockStatus } from "@/lib/utils";
import { queueNotification } from "@/lib/notifications/service";

export function previousWeekRange(reference = new Date()) {
  const day = reference.getDay() || 7;
  const currentMonday = startOfDay(subDays(reference, day - 1));
  const periodEnd = endOfDay(subDays(currentMonday, 1));
  const periodStart = startOfDay(subDays(periodEnd, 6));
  return { periodStart, periodEnd };
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

  const rows = inventory.map((entry) => {
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

  const lowStockCount = rows.filter((row) => row.stockStatus === "LOW_STOCK").length;
  const criticalStockCount = rows.filter((row) => row.stockStatus === "CRITICAL").length;
  const outOfStockCount = rows.filter((row) => row.stockStatus === "OUT_OF_STOCK").length;
  const report = await db.$transaction(async (tx) => {
    const existing = await tx.inventoryReport.findUnique({ where: { businessId_periodStart_periodEnd: { businessId, periodStart, periodEnd } } });
    if (existing) await tx.inventoryReportItem.deleteMany({ where: { reportId: existing.id } });
    const saved = await tx.inventoryReport.upsert({
      where: { businessId_periodStart_periodEnd: { businessId, periodStart, periodEnd } },
      update: { status: "COMPLETED", totalStockQuantity: rows.reduce((sum, row) => sum + row.entry.quantity, 0), totalCostValue: rows.reduce((sum, row) => sum + row.costValue, 0), totalSellingValue: rows.reduce((sum, row) => sum + row.sellingValue, 0), lowStockCount, criticalStockCount, outOfStockCount, generatedAt: new Date(), errorMessage: null },
      create: { businessId, periodStart, periodEnd, status: "COMPLETED", totalStockQuantity: rows.reduce((sum, row) => sum + row.entry.quantity, 0), totalCostValue: rows.reduce((sum, row) => sum + row.costValue, 0), totalSellingValue: rows.reduce((sum, row) => sum + row.sellingValue, 0), lowStockCount, criticalStockCount, outOfStockCount, generatedAt: new Date() },
    });
    if (rows.length) await tx.inventoryReportItem.createMany({ data: rows.map((row) => ({ reportId: saved.id, shopId: row.entry.shopId, productId: row.entry.productId, openingQuantity: row.openingQuantity, quantityAdded: row.quantityAdded, quantitySold: row.quantitySold, quantityTransferredIn: row.quantityTransferredIn, quantityTransferredOut: row.quantityTransferredOut, quantityDamaged: row.quantityDamaged, closingQuantity: row.entry.quantity, reorderLevel: row.entry.reorderLevel, criticalLevel: row.entry.criticalLevel, stockStatus: row.stockStatus, averageDailySales: row.averageDailySales, estimatedDaysRemaining: row.estimatedDaysRemaining, costValue: row.costValue, sellingValue: row.sellingValue })) });
    return saved;
  });

  await queueNotification({
    businessId,
    userId: admin.id,
    type: "WEEKLY_REPORT",
    title: "Weekly inventory report is ready",
    message: `${business.name}: ${lowStockCount} low, ${criticalStockCount} critical and ${outOfStockCount} out-of-stock product records require review.`,
    actionUrl: `/admin/reports/inventory/${report.id}`,
    push: true,
    email: { to: process.env.ADMIN_EMAIL ?? admin.email },
  });
  return report;
}
