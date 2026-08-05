import Link from "next/link";
import { AlertTriangle, Building2, CircleDollarSign, TrendingUp, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { formatMoney } from "@/lib/utils";
import { getAdminDashboardData } from "@/services/admin/dashboard-service";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { SalesChartClient as SalesChart } from "@/components/admin/sales-chart-client";
import { getStockStatusMeta } from "@/lib/stock-status";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await requireAdmin();
  const data = await getAdminDashboardData(user.businessId);
  const { business, inventoryHealth } = data;
  const attentionCount = inventoryHealth.low + inventoryHealth.critical + inventoryHealth.out;

  // sort shops by sales desc and compute a per-row color from green (high) to red (low)
  const shopRowsSorted = [...data.shopRows].sort((a, b) => b.sales - a.sales);
  function interpolateColorGreenToRed(t: number) {
    // t: 0 => green, 1 => red
    const r1 = 22, g1 = 163, b1 = 74; // #16a34a (emerald-600)
    const r2 = 239, g2 = 68, b2 = 68; // #ef4444 (red-500)
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgba(${r}, ${g}, ${b}, 0.12)`; // subtle tint
  }

  return (
    <>
      <PageHeading
        title={`Good day, ${business.name}`}
        description={`Live performance across ${data.activeShopCount} active shop${data.activeShopCount === 1 ? "" : "s"}.`}
      />
      <div className="kpi-grid">
        <KpiCard
          label="Today's sales"
          value={formatMoney(data.totalToday, business.currency)}
          helper={`${data.transactionCount} transactions`}
          icon={<CircleDollarSign className="h-5 w-5" />}
        />
        <KpiCard
          label="Estimated gross profit"
          value={formatMoney(data.grossProfit, business.currency)}
          helper="Based on captured item costs"
          icon={<TrendingUp className="h-5 w-5" />}
          tone="green"
        />
        <KpiCard
          label="Today's expenses"
          value={formatMoney(data.todayExpenseTotal, business.currency)}
          icon={<Wallet className="h-5 w-5" />}
          tone="amber"
        />
        <KpiCard
          label="Stock requiring attention"
          value={String(attentionCount)}
          helper={`${inventoryHealth.out} out of stock`}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="red"
        />
      </div>

      <div className="chart-grid mt-4">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Seven-day sales trend</h2>
              <p className="text-sm text-slate-500">Completed sales across all shops</p>
            </div>
          </CardHeader>
          <CardContent><SalesChart data={data.chartData} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Inventory health</h2>
              <p className="text-sm text-slate-500">Current thresholds across shops</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {([
              { key: "LOW_STOCK" as const, count: inventoryHealth.low },
              { key: "CRITICAL" as const, count: inventoryHealth.critical },
              { key: "OUT_OF_STOCK" as const, count: inventoryHealth.out },
              { key: "IN_STOCK" as const, count: inventoryHealth.healthy },
            ]).map(({ key, count }) => {
              const meta = getStockStatusMeta(key);
              const toneClass = meta.tone === "amber" ? "bg-amber-50 text-amber-800" : meta.tone === "red" ? "bg-red-50 text-red-700" : meta.tone === "slate" ? "bg-slate-100 text-slate-700" : "bg-emerald-50 text-emerald-700";
              return (
                <Link key={key} href={`/admin/reports/stock/status/${meta.slug}`} className={`flex items-center justify-between rounded-xl p-3 transition hover:opacity-90 ${toneClass}`}>
                  <span className="text-sm font-semibold">{meta.label}</span>
                  <strong>{count}</strong>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader>
          <div>
            <h2 className="font-extrabold">Shop performance today</h2>
            <p className="text-sm text-slate-500">Sales, transaction volume and current stock exposure.</p>
          </div>
        </CardHeader>
        {shopRowsSorted.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Shop</th><th>Sales</th><th>Transactions</th><th>Stock value</th><th>Alerts</th><th>Status</th></tr></thead>
              <tbody>
                {shopRowsSorted.map(({ shop, sales, transactions, stockValue, alerts }, idx) => {
                  const t = shopRowsSorted.length > 1 ? idx / (shopRowsSorted.length - 1) : 0; // 0..1
                  const bg = interpolateColorGreenToRed(t);
                  return (
                    <tr key={shop.id} style={{ backgroundColor: bg }}>
                      <td><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2 text-blue-700"><Building2 className="h-4 w-4" /></div><div><p className="font-bold">{shop.name}</p><p className="text-xs text-slate-500">{shop.code}</p></div></div></td>
                      <td className="font-bold">{formatMoney(sales, business.currency)}</td>
                      <td>{transactions}</td>
                      <td>{formatMoney(stockValue, business.currency)}</td>
                      <td>{alerts ? <Badge tone="warning">{alerts} alerts</Badge> : <Badge tone="success">Healthy</Badge>}</td>
                      <td><Badge tone="success">Active</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No shops created" description="Create the first shop and its account from the Shops module." />}
      </Card>
    </>
  );
}
