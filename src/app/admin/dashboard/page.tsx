import { AlertTriangle, Building2, CircleDollarSign, TrendingUp, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { formatMoney } from "@/lib/utils";
import { getAdminDashboardData } from "@/services/admin/dashboard-service";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import dynamicImport from "next/dynamic";
const SalesChart = dynamicImport(() => import("@/components/admin/sales-chart").then((m) => m.SalesChart), { ssr: false });

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await requireAdmin();
  const data = await getAdminDashboardData(user.businessId);
  const { business, inventoryHealth } = data;
  const attentionCount = inventoryHealth.low + inventoryHealth.critical + inventoryHealth.out;

  return (
    <>
      <PageHeading
        title={`Good day, ${user.name.split(" ")[0]}`}
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
            <div className="flex justify-between rounded-xl bg-amber-50 p-3"><span className="text-sm font-semibold text-amber-800">Low stock</span><strong>{inventoryHealth.low}</strong></div>
            <div className="flex justify-between rounded-xl bg-red-50 p-3"><span className="text-sm font-semibold text-red-700">Critical stock</span><strong>{inventoryHealth.critical}</strong></div>
            <div className="flex justify-between rounded-xl bg-slate-100 p-3"><span className="text-sm font-semibold text-slate-700">Out of stock</span><strong>{inventoryHealth.out}</strong></div>
            <div className="flex justify-between rounded-xl bg-emerald-50 p-3"><span className="text-sm font-semibold text-emerald-700">Healthy stock records</span><strong>{inventoryHealth.healthy}</strong></div>
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
        {data.shopRows.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Shop</th><th>Sales</th><th>Transactions</th><th>Stock value</th><th>Alerts</th><th>Status</th></tr></thead>
              <tbody>
                {data.shopRows.map(({ shop, sales, transactions, stockValue, alerts }) => (
                  <tr key={shop.id}>
                    <td><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2 text-blue-700"><Building2 className="h-4 w-4" /></div><div><p className="font-bold">{shop.name}</p><p className="text-xs text-slate-500">{shop.code}</p></div></div></td>
                    <td className="font-bold">{formatMoney(sales, business.currency)}</td>
                    <td>{transactions}</td>
                    <td>{formatMoney(stockValue, business.currency)}</td>
                    <td>{alerts ? <Badge tone="warning">{alerts} alerts</Badge> : <Badge tone="success">Healthy</Badge>}</td>
                    <td><Badge tone="success">Active</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No shops created" description="Create the first shop and its account from the Shops module." />}
      </Card>
    </>
  );
}
