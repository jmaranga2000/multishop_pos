import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { connectToMongoDB } from "@/lib/mongodb";
import { getStockStatus } from "@/lib/utils";

type BusinessDocument = {
  id: string;
  name: string;
  currency: string;
  timezone?: string;
};

type ShopDocument = {
  id: string;
  name: string;
  code: string;
};

type InventoryDocument = {
  shopId: string;
  quantity: number;
  costPrice: number | string;
  reorderLevel: number;
  criticalLevel: number;
};

type SalesFacetResult = {
  daily: Array<{ _id: string; sales: number }>;
  today: Array<{ _id: null; total: number; transactions: number }>;
  grossProfit: Array<{ _id: null; total: number }>;
  byShop: Array<{ _id: string; sales: number; transactions: number }>;
};

type ExpenseAggregateResult = {
  _id: null;
  total: number;
};

export async function getAdminDashboardData(businessId: string) {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const weekStart = subDays(todayStart, 6);
  const database = await connectToMongoDB();

  const [businessResult, shopsResult] = await Promise.all([
    database.collection("businesses").findOne(
      { id: businessId },
      { projection: { _id: 0, id: 1, name: 1, currency: 1, timezone: 1 } },
    ),
    database.collection("shops").find(
      { businessId, isActive: true },
      { projection: { _id: 0, id: 1, name: 1, code: 1 } },
    ).sort({ name: 1 }).toArray(),
  ]);
  const business = businessResult as BusinessDocument | null;
  const shops = shopsResult as unknown as ShopDocument[];
  if (!business) throw new Error("business record was not found.");

  const shopIds = shops.map((shop) => shop.id);
  if (!shopIds.length) {
    return {
      business,
      activeShopCount: 0,
      totalToday: 0,
      grossProfit: 0,
      todayExpenseTotal: 0,
      transactionCount: 0,
      inventoryHealth: { low: 0, critical: 0, out: 0, healthy: 0 },
      chartData: Array.from({ length: 7 }, (_, index) => ({
        label: format(subDays(todayStart, 6 - index), "EEE"),
        sales: 0,
      })),
      shopRows: [],
    };
  }

  const timezone = business.timezone ?? "Africa/Nairobi";
  const [salesFacetRows, inventoryRows, expenseRows] = await Promise.all([
    database.collection("sales").aggregate([
      {
        $match: {
          shopId: { $in: shopIds },
          status: "COMPLETED",
          occurredAt: { $gte: weekStart, $lte: todayEnd },
        },
      },
      {
        $facet: {
          daily: [
            {
              $group: {
                _id: {
                  $dateToString: {
                    date: "$occurredAt",
                    format: "%Y-%m-%d",
                    timezone,
                  },
                },
                sales: { $sum: "$total" },
              },
            },
          ],
          today: [
            { $match: { occurredAt: { $gte: todayStart, $lte: todayEnd } } },
            { $group: { _id: null, total: { $sum: "$total" }, transactions: { $sum: 1 } } },
          ],
          grossProfit: [
            { $match: { occurredAt: { $gte: todayStart, $lte: todayEnd } } },
            {
              $lookup: {
                from: "saleItems",
                localField: "id",
                foreignField: "saleId",
                as: "items",
              },
            },
            { $unwind: "$items" },
            {
              $group: {
                _id: null,
                total: {
                  $sum: {
                    $multiply: [
                      { $subtract: ["$items.unitPrice", "$items.unitCost"] },
                      "$items.quantity",
                    ],
                  },
                },
              },
            },
          ],
          byShop: [
            { $match: { occurredAt: { $gte: todayStart, $lte: todayEnd } } },
            { $group: { _id: "$shopId", sales: { $sum: "$total" }, transactions: { $sum: 1 } } },
          ],
        },
      },
    ]).toArray(),
    database.collection("shopInventories").find(
      { shopId: { $in: shopIds } },
      {
        projection: {
          _id: 0,
          shopId: 1,
          quantity: 1,
          costPrice: 1,
          reorderLevel: 1,
          criticalLevel: 1,
        },
      },
    ).toArray(),
    database.collection("expenses").aggregate([
      {
        $match: {
          shopId: { $in: shopIds },
          status: "APPROVED",
          occurredAt: { $gte: todayStart, $lte: todayEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]).toArray(),
  ]);
  const salesFacet = (salesFacetRows[0] ?? {
    daily: [],
    today: [],
    grossProfit: [],
    byShop: [],
  }) as unknown as SalesFacetResult;
  const inventory = inventoryRows as unknown as InventoryDocument[];
  const expenses = expenseRows as unknown as ExpenseAggregateResult[];

  const dailySales = new Map(salesFacet.daily.map((row) => [row._id, Number(row.sales) || 0]));
  const today = salesFacet.today[0];
  const grossProfit = Number(salesFacet.grossProfit[0]?.total ?? 0);
  const salesByShop = new Map(
    salesFacet.byShop.map((row) => [
      row._id,
      { sales: Number(row.sales) || 0, transactions: Number(row.transactions) || 0 },
    ]),
  );
  const inventoryByShop = new Map<string, InventoryDocument[]>();
  for (const entry of inventory) {
    const rows = inventoryByShop.get(entry.shopId) ?? [];
    rows.push(entry);
    inventoryByShop.set(entry.shopId, rows);
  }

  const low = inventory.filter(
    (entry) => getStockStatus(entry.quantity, entry.reorderLevel, entry.criticalLevel) === "LOW_STOCK",
  );
  const critical = inventory.filter(
    (entry) => getStockStatus(entry.quantity, entry.reorderLevel, entry.criticalLevel) === "CRITICAL",
  );
  const out = inventory.filter((entry) => entry.quantity <= 0);

  return {
    business,
    activeShopCount: shops.length,
    totalToday: Number(today?.total ?? 0),
    grossProfit,
    todayExpenseTotal: Number(expenses[0]?.total ?? 0),
    transactionCount: Number(today?.transactions ?? 0),
    inventoryHealth: {
      low: low.length,
      critical: critical.length,
      out: out.length,
      healthy: inventory.length - low.length - critical.length - out.length,
    },
    chartData: Array.from({ length: 7 }, (_, index) => {
      const date = subDays(todayStart, 6 - index);
      return {
        label: format(date, "EEE"),
        sales: dailySales.get(format(date, "yyyy-MM-dd")) ?? 0,
      };
    }),
    shopRows: shops.map((shop) => {
      const shopSales = salesByShop.get(shop.id) ?? { sales: 0, transactions: 0 };
      const shopInventory = inventoryByShop.get(shop.id) ?? [];
      return {
        shop,
        sales: shopSales.sales,
        transactions: shopSales.transactions,
        stockValue: shopInventory.reduce(
          (sum, entry) => sum + Number(entry.costPrice) * entry.quantity,
          0,
        ),
        alerts: shopInventory.filter((entry) => entry.quantity <= entry.reorderLevel).length,
      };
    }),
  };
}
