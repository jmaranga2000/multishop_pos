import Link from "next/link";
import { AlertTriangle, BarChart3, Download, Layers } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { formatMoney } from "@/lib/utils";
import { getStockIntelligenceData } from "@/services/admin/report-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { StockIntelligenceCharts } from "@/components/admin/stock-intelligence-charts";

export const dynamic = "force-dynamic";

export default async function StockIntelligencePage() {
  const user = await requireAdmin();
  const data = await getStockIntelligenceData(user.businessId);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeading
          title="Stock intelligence"
          description="Understand current stock risk by shop, product category and action priority."
        />
        <div className="flex flex-wrap gap-2">
          <Button as={Link} href="/admin/reports/inventory" size="sm" variant="secondary">
            Weekly inventory
          </Button>
          <Button as={Link} href="/admin/reports/daily" size="sm" variant="ghost">
            Today&apos;s snapshot
          </Button>
          <Button as={Link} href="/api/reports/stock/intelligence.csv" target="_blank" rel="noreferrer" size="sm" variant="secondary">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-3xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 text-slate-700">
            <Layers className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">Inventory exposure</p>
              <p className="text-xs text-slate-500">Value of stock currently held across all shops.</p>
            </div>
          </div>
          <div className="mt-6">
            <p className="text-sm text-slate-500">Cost value</p>
            <p className="mt-2 text-3xl font-black">{formatMoney(data.shopSummaries.reduce((sum, shop) => sum + shop.totalValue, 0).toString(), data.business.currency)}</p>
          </div>
        </Card>

        <Card className="rounded-3xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 text-slate-700">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">Stock at risk</p>
              <p className="text-xs text-slate-500">Products that need action in the next stock review.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3">
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

        <Card className="rounded-3xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 text-slate-700">
            <BarChart3 className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">Top risk products</p>
              <p className="text-xs text-slate-500">These records are the highest priority for review.</p>
            </div>
          </div>
          {data.topRiskProducts.length ? (
            <div className="mt-6 space-y-3">
              {data.topRiskProducts.slice(0, 5).map((product) => (
                <div key={product.id} className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold">{product.product}</p>
                  <p className="mt-1 text-xs text-slate-500">{product.sku} • {product.shop}</p>
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                    <span>{product.stockStatus.replaceAll("_", " ")}</span>
                    <span className="font-black">{product.quantity}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No risk products" description="All stock records are currently healthy." />
          )}
        </Card>
      </div>

      <StockIntelligenceCharts
        inventory={data.inventory}
        shops={data.shops}
        categories={data.categories}
        history={data.history}
        movementTrend={data.movementTrend}
        businessCurrency={data.business.currency}
      />

      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Shop</th>
                <th>Products</th>
                <th>Value</th>
                <th>Low</th>
                <th>Critical</th>
                <th>Out</th>
              </tr>
            </thead>
            <tbody>
              {data.shopSummaries.map((summary) => (
                <tr key={summary.shop.id}>
                  <td>{summary.shop.name}</td>
                  <td>{summary.totalProducts}</td>
                  <td>{formatMoney(summary.totalValue.toString(), data.business.currency)}</td>
                  <td>{summary.lowStockCount}</td>
                  <td>{summary.criticalStockCount}</td>
                  <td>{summary.outOfStockCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
