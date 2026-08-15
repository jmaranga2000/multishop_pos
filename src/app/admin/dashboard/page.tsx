import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CircleDollarSign,
  PackageCheck,
  ShieldAlert,
  ShoppingCart,
  Truck,
  Wallet,
} from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { formatMoney } from "@/lib/utils";
import { getAdminDashboardData } from "@/services/admin/dashboard-service";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeading } from "@/components/ui/page-heading";
import { SalesChartClient as SalesChart } from "@/components/admin/sales-chart-client";
import { getStockStatusMeta } from "@/lib/stock-status";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await requireAdmin();
  const data = await getAdminDashboardData(user.businessId);
  const { business, inventoryHealth, operational, inventoryWatchlist } = data;
  const attentionCount = inventoryHealth.low + inventoryHealth.critical + inventoryHealth.out;
  const grossMargin = data.totalToday > 0 ? (data.grossProfit / data.totalToday) * 100 : 0;
  const shopRowsSorted = [...data.shopRows].sort((a, b) => b.sales - a.sales);

  function interpolateColorGreenToRed(t: number) {
    const r1 = 6, g1 = 95, b1 = 70;
    const r2 = 185, g2 = 28, b2 = 28;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgba(${r}, ${g}, ${b}, 0.18)`;
  }

  const overviewCards = [
    {
      label: "Sales today",
      value: formatMoney(data.totalToday, business.currency),
      helper: `${data.transactionCount} transactions`,
      icon: <CircleDollarSign className="h-5 w-5" />,
      tone: "blue" as const,
    },
    {
      label: "Gross profit",
      value: formatMoney(data.grossProfit, business.currency),
      helper: `${grossMargin.toFixed(1)}% margin`,
      icon: <ArrowUpRight className="h-5 w-5" />,
      tone: "green" as const,
    },
    {
      label: "Approved costs",
      value: formatMoney(data.todayExpenseTotal, business.currency),
      helper: "This period’s operating spend",
      icon: <Wallet className="h-5 w-5" />,
      tone: "amber" as const,
    },
    {
      label: "Stock at risk",
      value: String(attentionCount),
      helper: `${inventoryHealth.out} unavailable`,
      icon: <AlertTriangle className="h-5 w-5" />,
      tone: "red" as const,
    },
  ];

  return (
    <>
      <PageHeading
        title={`Operations overview for ${business.name}`}
        description={`Monitoring ${data.activeShopCount} active shop${data.activeShopCount === 1 ? "" : "s"} across sales, stock, approvals, and system health.`}
      />

      <div className="kpi-grid">
        {overviewCards.map((card) => (
          <KpiCard
            key={card.label}
            label={card.label}
            value={card.value}
            helper={card.helper}
            icon={card.icon}
            tone={card.tone}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Business momentum</h2>
              <p className="text-sm text-slate-500">Seven-day sales trend across all active shops.</p>
            </div>
          </CardHeader>
          <CardContent>
            <SalesChart data={data.chartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Inventory health</h2>
              <p className="text-sm text-slate-500">Current stock risk by threshold.</p>
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
              const toneClass = meta.tone === "amber"
                ? "bg-amber-50 text-amber-800"
                : meta.tone === "red"
                  ? "bg-red-50 text-red-700"
                  : meta.tone === "slate"
                    ? "bg-slate-100 text-slate-700"
                    : "bg-emerald-50 text-emerald-700";

              return (
                <Link
                  key={key}
                  href={`/admin/reports/stock/status/${meta.slug}`}
                  className={`flex items-center justify-between rounded-xl p-3 transition hover:opacity-90 ${toneClass}`}
                >
                  <span className="text-sm font-semibold">{meta.label}</span>
                  <strong>{count}</strong>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Procurement watchlist</h2>
              <p className="text-sm text-slate-500">Stock and transfer actions needing attention.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2 text-slate-700">
                <Truck className="h-4 w-4" />
                <span className="text-sm font-medium">Pending transfers</span>
              </div>
              <Badge tone="warning">{operational.pendingTransfers}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2 text-slate-700">
                <PackageCheck className="h-4 w-4" />
                <span className="text-sm font-medium">Stock at risk</span>
              </div>
              <Badge tone="danger">{attentionCount}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2 text-slate-700">
                <ShoppingCart className="h-4 w-4" />
                <span className="text-sm font-medium">Approval queue</span>
              </div>
              <Badge tone="info">{operational.pendingExpenses + operational.pendingRefunds}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Inventory watchlist</h2>
              <p className="text-sm text-slate-500">Most urgent items that need restocking.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {inventoryWatchlist.length ? (
              inventoryWatchlist.map((item) => {
                const statusMeta = getStockStatusMeta(item.status);
                return (
                  <div key={`${item.shopId}-${item.productId}`} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{item.productName}</p>
                        <p className="text-xs text-slate-500">{item.shopName}</p>
                      </div>
                      <Badge tone={statusMeta.tone === "red" ? "danger" : statusMeta.tone === "amber" ? "warning" : "info"}>{statusMeta.label}</Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                      <span>Qty: {item.quantity}</span>
                      <span>Reorder: {item.reorderLevel}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">No items are currently below their target stock thresholds.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">System health</h2>
              <p className="text-sm text-slate-500">Connectivity and operational control checks.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/synchronization" className="flex items-center justify-between rounded-xl border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50">
              <div className="flex items-center gap-2 text-slate-700">
                <ShieldAlert className="h-4 w-4" />
                <span className="text-sm font-medium">Open sync conflicts</span>
              </div>
              <Badge tone={operational.openConflicts ? "danger" : "success"}>{operational.openConflicts}</Badge>
            </Link>
            <Link href="/admin/devices" className="flex items-center justify-between rounded-xl border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50">
              <div className="flex items-center gap-2 text-slate-700">
                <PackageCheck className="h-4 w-4" />
                <span className="text-sm font-medium">Active devices</span>
              </div>
              <Badge tone="info">{operational.activeDevices}</Badge>
            </Link>
            <Link href="/admin/expenses" className="flex items-center justify-between rounded-xl border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50">
              <div className="flex items-center gap-2 text-slate-700">
                <Wallet className="h-4 w-4" />
                <span className="text-sm font-medium">Pending expenses</span>
              </div>
              <Badge tone="warning">{operational.pendingExpenses}</Badge>
            </Link>
            <Link href="/admin/refunds" className="flex items-center justify-between rounded-xl border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50">
              <div className="flex items-center gap-2 text-slate-700">
                <ShoppingCart className="h-4 w-4" />
                <span className="text-sm font-medium">Pending refunds</span>
              </div>
              <Badge tone="warning">{operational.pendingRefunds}</Badge>
            </Link>
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
                  const t = shopRowsSorted.length > 1 ? idx / (shopRowsSorted.length - 1) : 0;
                  const bg = interpolateColorGreenToRed(t);
                  return (
                    <tr key={shop.id} style={{ backgroundColor: bg }}>
                      <td><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2 text-blue-700"><span className="text-xs font-bold">{shop.name.slice(0, 1)}</span></div><div><p className="font-bold">{shop.name}</p><p className="text-xs text-slate-500">{shop.code}</p></div></div></td>
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
        ) : (
          <div className="px-(--card-spacing) pb-(--card-spacing)">
            <p className="text-sm text-slate-500">No shops created yet.</p>
          </div>
        )}
      </Card>
    </>
  );
}
