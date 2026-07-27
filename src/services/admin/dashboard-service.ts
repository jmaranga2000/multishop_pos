import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getStockStatus } from "@/lib/utils";

export async function getAdminDashboardData(businessId: string) {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const [business, shops, sales, inventory, expenses] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId } }),
    prisma.shop.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.sale.findMany({
      where: {
        shop: { businessId },
        occurredAt: { gte: subDays(todayStart, 6), lte: todayEnd },
        status: "COMPLETED",
      },
      include: { items: true, shop: true },
    }),
    prisma.shopInventory.findMany({
      where: { shop: { businessId } },
      include: { product: true, shop: true },
    }),
    prisma.expense.aggregate({
      where: { shop: { businessId }, status: "APPROVED", occurredAt: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
    }),
  ]);

  const todaySales = sales.filter((sale) => sale.occurredAt >= todayStart);
  const totalToday = todaySales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const grossProfit = todaySales.reduce(
    (sum, sale) => sum + sale.items.reduce(
      (itemSum, item) => itemSum + (Number(item.unitPrice) - Number(item.unitCost)) * item.quantity,
      0,
    ),
    0,
  );
  const low = inventory.filter((entry) => getStockStatus(entry.quantity, entry.reorderLevel, entry.criticalLevel) === "LOW_STOCK");
  const critical = inventory.filter((entry) => getStockStatus(entry.quantity, entry.reorderLevel, entry.criticalLevel) === "CRITICAL");
  const out = inventory.filter((entry) => entry.quantity <= 0);
  const chartData = Array.from({ length: 7 }, (_, index) => {
    const date = subDays(todayStart, 6 - index);
    return {
      label: format(date, "EEE"),
      sales: sales
        .filter((sale) => format(sale.occurredAt, "yyyy-MM-dd") === format(date, "yyyy-MM-dd"))
        .reduce((sum, sale) => sum + Number(sale.total), 0),
    };
  });
  const shopRows = shops.map((shop) => {
    const shopSales = todaySales.filter((sale) => sale.shopId === shop.id);
    const shopInventory = inventory.filter((entry) => entry.shopId === shop.id);
    return {
      shop,
      sales: shopSales.reduce((sum, sale) => sum + Number(sale.total), 0),
      transactions: shopSales.length,
      stockValue: shopInventory.reduce((sum, entry) => sum + Number(entry.costPrice) * entry.quantity, 0),
      alerts: shopInventory.filter((entry) => entry.quantity <= entry.reorderLevel).length,
    };
  });

  return {
    business,
    activeShopCount: shops.length,
    totalToday,
    grossProfit,
    todayExpenseTotal: Number(expenses._sum.amount ?? 0),
    transactionCount: todaySales.length,
    inventoryHealth: {
      low: low.length,
      critical: critical.length,
      out: out.length,
      healthy: inventory.length - low.length - critical.length - out.length,
    },
    chartData,
    shopRows,
  };
}
