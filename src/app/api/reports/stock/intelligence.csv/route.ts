import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/rbac";
import { getStockIntelligenceData } from "@/services/admin/report-service";

export async function GET() {
  const user = await requireAdmin();
  const data = await getStockIntelligenceData(user.businessId);

  const headers = ["Shop", "Products", "Value", "Low stock", "Critical stock", "Out of stock"];
  const rows = data.shopSummaries.map((summary) => [
    summary.shop.name,
    summary.totalProducts.toString(),
    summary.totalValue.toString(),
    summary.lowStockCount.toString(),
    summary.criticalStockCount.toString(),
    summary.outOfStockCount.toString(),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stock-intelligence-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
