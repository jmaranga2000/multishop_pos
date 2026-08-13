import { connectToMongoDB } from "@/lib/mongodb";
import { renderToBuffer } from "@react-pdf/renderer";
import { DailySnapshotPdf, type DailySnapshotPdfData } from "./daily-snapshot-pdf";
import { formatVariance, fromMinorUnits } from "@/lib/utils";
import { endOfDay, startOfDay } from "date-fns";

export async function buildDailySnapshotDataForShop(businessId: string, shopId: string, date: Date) {
  const db = await connectToMongoDB();
  const periodStart = startOfDay(date);
  const periodEnd = endOfDay(date);

  const [shop] = await Promise.all([
    db.collection("shops").find({ businessId, id: shopId }, { projection: { _id: 0, name: 1 } }).toArray(),
  ]);

  const shopName = (shop && shop.length ? shop[0].name : "Shop") as string;

  // sales and items
  const sales = await db.collection("sales").find({ shopId, status: "COMPLETED", occurredAt: { $gte: periodStart, $lte: periodEnd } }).toArray();
  const saleIds = sales.map((s: any) => s.id);
  const saleItems = saleIds.length ? await db.collection("saleItems").find({ saleId: { $in: saleIds } }).toArray() : [];

  // compute totals
  const totalSalesCount = sales.length;
  const totalRevenue = saleItems.reduce((sum: number, it: any) => sum + Number(it.lineTotal ?? 0), 0);
  const totalProfit = saleItems.reduce((sum: number, it: any) => sum + (Number(it.unitPrice ?? 0) - Number(it.unitCost ?? 0)) * Number(it.quantity ?? 0), 0);

  // expenses
  const expenses = await db.collection("expenses").find({ shopId, status: "APPROVED", occurredAt: { $gte: periodStart, $lte: periodEnd } }).toArray();
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + Number(e.amount ?? 0), 0);

  // best/worst sellers by quantity
  const totalsByProduct = new Map<string, { quantity: number; revenue: number }>();
  for (const it of saleItems) {
    const pname = it.productName ?? "Unknown product";
    const existing = totalsByProduct.get(pname) ?? { quantity: 0, revenue: 0 };
    existing.quantity += Number(it.quantity ?? 0);
    existing.revenue += Number(it.lineTotal ?? 0);
    totalsByProduct.set(pname, existing);
  }

  const productsArray = Array.from(totalsByProduct.entries()).map(([productName, totals]) => ({ productName, quantity: totals.quantity, revenue: totals.revenue }));
  const bestSellers = productsArray.slice().sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  const worstSellers = productsArray.slice().sort((a, b) => a.quantity - b.quantity).slice(0, 5);

  // inventory alerts
  const inventories = await db.collection("shopInventories").find({ shopId }).toArray();
  const criticalProducts = inventories.filter((r: any) => Number(r.quantity ?? 0) <= Number(r.criticalLevel ?? 0)).map((r: any) => ({ productName: String(r.productName ?? r.productId), status: "CRITICAL" as const }));
  const lowProducts = inventories.filter((r: any) => Number(r.quantity ?? 0) <= Number(r.reorderLevel ?? 0) && Number(r.quantity ?? 0) > Number(r.criticalLevel ?? 0)).map((r: any) => ({ productName: String(r.productName ?? r.productId), status: "LOW_STOCK" as const }));

  // register open/close and variance
  const session = await db.collection("registerSessions").findOne({ shopId, openedAt: { $gte: periodStart, $lte: periodEnd } });
  const openedAt = session?.openedAt ? new Date(session.openedAt).toISOString() : null;
  const closedAt = session?.closedAt ? new Date(session.closedAt).toISOString() : null;
  const variance = session ? (session.actualCash !== undefined && session.actualCash !== null ? Number(session.actualCash) - Number(session.expectedCash ?? 0) : null) : null;

  const data: DailySnapshotPdfData = {
    shopName,
    dateTitle: periodStart.toLocaleDateString("en-KE"),
    generatedAt: new Date().toLocaleString("en-KE"),
    totalSalesCount,
    totalRevenue,
    totalProfit,
    totalExpenses,
    variance,
    openedAt,
    closedAt,
    bestSellers,
    worstSellers,
    criticalProducts,
    lowProducts,
  };

  return data;
}

export async function renderDailySnapshotPdfBuffer(data: DailySnapshotPdfData) {
  const buffer = await renderToBuffer(<DailySnapshotPdf report={data} /> as any);
  return buffer;
}
