import Link from "next/link";
import { CalendarDays, Clock3, FileText } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { formatMoney } from "@/lib/utils";
import { getDailySnapshotData } from "@/services/admin/report-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DailySnapshotPage() {
  const user = await requireAdmin();
  const data = await getDailySnapshotData(user.businessId);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeading
          title="Today's snapshot"
          description="This report shows current stock health and today’s completed sales across all shops."
        />
        <div className="flex flex-wrap gap-2">
          <Button as={Link} href="/admin/reports/stock" size="sm" variant="secondary">
            Stock intelligence
          </Button>
          <Button as={Link} href="/admin/reports/inventory" size="sm" variant="ghost">
            Weekly inventory
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 text-slate-700">
            <CalendarDays className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">Snapshot date</p>
              <p className="text-xs text-slate-500">Updated from current central stock and today’s completed sales.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Total sales</p>
              <p className="mt-2 text-3xl font-black">{formatMoney(data.dailySales.total.toString(), data.business.currency)}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Transactions</p>
              <p className="mt-2 text-3xl font-black">{data.dailySales.transactions}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Snapshot fresh</p>
              <p className="mt-2 text-3xl font-black">Now</p>
            </div>
          </div>

          <Card className="mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Shop</th>
                    <th>Products</th>
                    <th>Low</th>
                    <th>Critical</th>
                    <th>Out</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.shopSummaries.map((shop) => (
                    <tr key={shop.shop?.id ?? `${shop.inventoryCount}-${shop.inventoryValue}`}>
                      <td>{shop.shop?.name ?? "Unknown"}</td>
                      <td>{shop.inventoryCount}</td>
                      <td>{shop.lowStockCount}</td>
                      <td>{shop.criticalStockCount}</td>
                      <td>{shop.outOfStockCount}</td>
                      <td>{formatMoney(shop.inventoryValue.toString(), data.business.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Card>

        <Card className="rounded-3xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 text-slate-700">
            <Clock3 className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">Stock risk summary</p>
              <p className="text-xs text-slate-500">Current product status by quantity thresholds.</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Healthy</p>
              <p className="mt-2 text-2xl font-black">{data.stockHealth.healthy}</p>
            </div>
            <div className="rounded-3xl bg-amber-50 p-4">
              <p className="text-sm text-amber-800">Low stock</p>
              <p className="mt-2 text-2xl font-black">{data.stockHealth.low}</p>
            </div>
            <div className="rounded-3xl bg-red-50 p-4">
              <p className="text-sm text-red-800">Critical stock</p>
              <p className="mt-2 text-2xl font-black">{data.stockHealth.critical}</p>
            </div>
            <div className="rounded-3xl bg-slate-100 p-4">
              <p className="text-sm text-slate-500">Out of stock</p>
              <p className="mt-2 text-2xl font-black">{data.stockHealth.out}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4 rounded-3xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 text-slate-700">
          <FileText className="h-5 w-5" />
          <div>
            <p className="text-sm font-semibold">Action summary</p>
            <p className="text-xs text-slate-500">Review products close to reorder and out-of-stock risks by shop.</p>
          </div>
        </div>

        {data.topRiskProducts.length ? (
          <div className="mt-6 overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Shop</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {data.topRiskProducts.map((item) => (
                  <tr key={`${item.product}-${item.shop}-${item.sku}`}>
                    <td>{item.product}</td>
                    <td>{item.shop}</td>
                    <td>{item.quantity}</td>
                    <td><Badge tone={item.stockStatus === "IN_STOCK" ? "success" : item.stockStatus === "LOW_STOCK" ? "warning" : "danger"}>{item.stockStatus.replaceAll("_", " ")}</Badge></td>
                    <td>{formatMoney(item.value.toString(), data.business.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No urgent stock actions" description="All shop snapshots are healthy for today." />
        )}
      </Card>
    </>
  );
}
