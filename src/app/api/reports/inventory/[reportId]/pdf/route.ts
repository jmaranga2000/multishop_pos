import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/rbac";
import { getInventoryReportDetail } from "@/services/admin/report-service";
import { WeeklyInventoryReportPdf } from "@/lib/reports/weekly-report-pdf";
import { loadWeeklyReportSummary } from "@/lib/reports/weekly-inventory";

export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const user = await requireAdmin();
  const { reportId } = await params;
  const report = await getInventoryReportDetail(user.businessId, reportId);
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const summary = await loadWeeklyReportSummary(user.businessId, report.periodStart, report.periodEnd);
  const pdfData = {
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
    stockSummary: summary.stockSummary,
  };

  const buffer = await renderToBuffer(createElement(WeeklyInventoryReportPdf, { report: pdfData }) as Parameters<typeof renderToBuffer>[0]);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="weekly-inventory-${report.periodStart.toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
