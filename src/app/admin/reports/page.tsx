import Link from "next/link";
import { FileSpreadsheet, Signal, Clock3 } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { formatMoney } from "@/lib/utils";
import { getAdminReportsOverview } from "@/services/admin/report-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { getStockStatusMeta } from "@/lib/stock-status";
import { ReportPdfExportButton } from "@/components/admin/report-pdf-export-button";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requireAdmin();
  const data = await getAdminReportsOverview(user.businessId);

  return (
    <>
      <PageHeading
        title="Reports & stock intelligence"
        description="A central view of weekly inventory reporting, stock health, and today's shop snapshot."
      />

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">Latest weekly inventory report</h2>
              <p className="mt-2 text-sm text-slate-500">
                Generated from stock movement and inventory reconciliation across all shops.
              </p>
            </div>
            {data.latestReport ? (
              <div className="text-right">
                <p className="text-sm text-slate-500">Period</p>
                <p className="font-semibold">
                  {data.latestReport.periodStart.toLocaleDateString("en-KE")} – {data.latestReport.periodEnd.toLocaleDateString("en-KE")}
                </p>
              </div>
            ) : null}
          </div>

          {data.latestReport ? (
            <>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button href={`/admin/reports/inventory/${data.latestReport.id}`} size="sm" variant="secondary">
                  View latest report
                </Button>
                <Button href="/admin/reports/inventory" size="sm" variant="ghost">
                  All inventory reports
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button href={`/api/reports/inventory/${data.latestReport.id}/excel`} target="_blank" rel="noreferrer" size="sm" variant="secondary">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
                <ReportPdfExportButton url={`/api/reports/inventory/${data.latestReport.id}/pdf`} fileName={`weekly-inventory-${data.latestReport.periodStart.toISOString().slice(0, 10)}.pdf`} label="PDF" variant="ghost" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Card className="rounded-3xl border border-slate-200 p-5">
                  <p className="text-sm text-slate-500">Units remaining</p>
                  <p className="mt-2 text-3xl font-black">{data.latestReport.totalStockQuantity}</p>
                </Card>
                <Card className="rounded-3xl border border-slate-200 p-5">
                  <p className="text-sm text-slate-500">Total cost value</p>
                  <p className="mt-2 text-3xl font-black">{formatMoney(data.latestReport.totalCostValue.toString(), data.business.currency)}</p>
                </Card>
                <Card className="rounded-3xl border border-slate-200 p-5">
                  <p className="text-sm text-slate-500">Stock alerts</p>
                  <p className="mt-2 text-3xl font-black">{data.latestReport.lowStockCount + data.latestReport.criticalStockCount + data.latestReport.outOfStockCount}</p>
                </Card>
              </div>
            </>
          ) : (
            <EmptyState
              icon={<FileSpreadsheet className="h-8 w-8" />}
              title="No weekly inventory reports yet"
              description="Generate the first report from the inventory reports page, or trigger the weekly report job."
            />
          )}
        </Card>

        <Card className="rounded-3xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 text-slate-700">
            <Signal className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">Stock health</p>
              <p className="text-xs text-slate-500">Low, critical and out-of-stock records across shops.</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <Link href="/admin/reports/stock/status/healthy-stock" className="block rounded-3xl bg-slate-50 p-4 transition hover:opacity-90">
              <p className="text-sm text-slate-500">Healthy stock records</p>
              <p className="mt-2 text-2xl font-black">{data.stockHealth.healthy}</p>
            </Link>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                { key: "LOW_STOCK" as const, count: data.stockHealth.low },
                { key: "CRITICAL" as const, count: data.stockHealth.critical },
                { key: "OUT_OF_STOCK" as const, count: data.stockHealth.out },
              ]).map(({ key, count }) => {
                const meta = getStockStatusMeta(key);
                const toneClass = meta.tone === "amber" ? "bg-amber-50 text-amber-700" : meta.tone === "red" ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-700";
                return (
                  <Link key={key} href={`/admin/reports/stock/status/${meta.slug}`} className={`block rounded-3xl p-4 transition hover:opacity-90 ${toneClass}`}>
                    <p className="text-sm font-semibold">{meta.label}</p>
                    <p className="mt-2 text-xl font-black">{count}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl border border-slate-200 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Report activity</h2>
              <p className="mt-2 text-sm text-slate-500">Latest inventory snapshots and generated reports.</p>
            </div>
            <div className="rounded-3xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              Weekly job: {data.weeklySchedule.day}, {data.weeklySchedule.hour}:00
            </div>
          </div>

          {data.reports.length ? (
            <div className="mt-6 overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Status</th>
                    <th>Units</th>
                    <th>Low</th>
                    <th>Critical</th>
                    <th>Out</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reports.map((report) => (
                    <tr key={report.id}>
                      <td>{report.periodStart.toLocaleDateString("en-KE")} – {report.periodEnd.toLocaleDateString("en-KE")}</td>
                      <td><Badge tone={report.status === "COMPLETED" ? "success" : "warning"}>{report.status}</Badge></td>
                      <td>{report.totalStockQuantity}</td>
                      <td>{report.lowStockCount}</td>
                      <td>{report.criticalStockCount}</td>
                      <td>{report.outOfStockCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No report history" description="Weekly inventory snapshots will appear here once generated." />
          )}
        </Card>

        <Card className="rounded-3xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 text-slate-700">
            <Clock3 className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">Today&apos;s snapshot</p>
              <p className="text-xs text-slate-500">Current sales and stock visibility for all active shops.</p>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Sales today</p>
              <p className="mt-2 text-2xl font-black">{formatMoney(data.dailySales.total.toString(), data.business.currency)}</p>
              <p className="mt-1 text-sm text-slate-500">{data.dailySales.transactions} transactions</p>
            </div>
            <Button href="/admin/reports/daily" size="md">
              View today&apos;s snapshot
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
