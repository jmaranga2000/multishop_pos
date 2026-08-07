import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/rbac";
import { getInventoryReportDetail } from "@/services/admin/report-service";
import { WeeklyInventoryReportPdf, type WeeklyReportPdfData } from "@/lib/reports/weekly-report-pdf";
import { loadWeeklyReportSummary } from "@/lib/reports/weekly-inventory";

export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const user = await requireAdmin();
  const { reportId } = await params;
  const report = await getInventoryReportDetail(user.businessId, reportId);
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const summary = await loadWeeklyReportSummary(user.businessId, report.periodStart, report.periodEnd);
  type StockSummaryRow = {
    shopName: string;
    totalProducts: number;
    lowStockCount: number;
    criticalStockCount: number;
    outOfStockCount: number;
    inventoryValue: number;
  };

  const stockSummary = Array.from(
    report.items
      .reduce((map: Map<string, StockSummaryRow>, item: { shop: { name: string }; stockStatus: string; costValue?: number | string | null }) => {
        const shopName = item.shop.name;
        const existing = map.get(shopName) ?? {
          shopName,
          totalProducts: 0,
          lowStockCount: 0,
          criticalStockCount: 0,
          outOfStockCount: 0,
          inventoryValue: 0,
        };
        existing.totalProducts += 1;
        existing.lowStockCount += item.stockStatus === "LOW_STOCK" ? 1 : 0;
        existing.criticalStockCount += item.stockStatus === "CRITICAL" ? 1 : 0;
        existing.outOfStockCount += item.stockStatus === "OUT_OF_STOCK" ? 1 : 0;
        existing.inventoryValue += Number(item.costValue ?? 0);
        map.set(shopName, existing);
        return map;
      }, new Map<string, StockSummaryRow>())
      .values(),
  ) as StockSummaryRow[];

  const pdfData: WeeklyReportPdfData = {
    businessName: report.business.name,
    currency: report.business.currency,
    periodTitle: `${report.periodStart.toLocaleDateString("en-KE")} – ${report.periodEnd.toLocaleDateString("en-KE")}`,
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

  const buffer = await renderToBuffer(createElement(WeeklyInventoryReportPdf, { report: pdfData }) as Parameters<typeof renderToBuffer>[0]);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="weekly-inventory-${report.periodStart.toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
