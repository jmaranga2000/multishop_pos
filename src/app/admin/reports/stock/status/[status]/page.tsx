import Link from "next/link";
import { ArrowLeft, Building2, Package2 } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/rbac";
import { getStockStatusMeta, type StockStatusKey } from "@/lib/stock-status";
import { getStockIntelligenceData } from "@/services/admin/report-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

const STOCK_STATUSES: StockStatusKey[] = ["LOW_STOCK", "CRITICAL", "OUT_OF_STOCK", "IN_STOCK"];

export default async function StockStatusPage({ params, searchParams }: { params: Promise<{ status: string }>; searchParams?: Promise<{ shopId?: string; categoryId?: string }> }) {
  const user = await requireAdmin();
  const { status } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const normalizedStatus = status?.toUpperCase();
  const isKnownStatus = STOCK_STATUSES.includes(normalizedStatus as StockStatusKey);

  if (!isKnownStatus) {
    notFound();
  }

  const data = await getStockIntelligenceData(user.businessId);
  const inventoryRows = data.inventory.filter((item) => item.stockStatus === normalizedStatus);
  const selectedShopId = resolvedSearchParams.shopId ?? "";
  const selectedCategoryId = resolvedSearchParams.categoryId ?? "";
  const filteredRows = inventoryRows.filter((row) => {
    const matchesShop = !selectedShopId || row.shopId === selectedShopId;
    const matchesCategory = !selectedCategoryId || row.product?.categoryId === selectedCategoryId;
    return matchesShop && matchesCategory;
  });
  const meta = getStockStatusMeta(normalizedStatus as StockStatusKey);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeading
          title={`${meta.label} details`}
          description={meta.description}
        />
        <Button as={Link} href="/admin/reports/stock" size="sm" variant="secondary">
          <ArrowLeft className="h-4 w-4" />
          Back to stock intelligence
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-600">Filtered view</p>
              <p className="text-lg font-black">{filteredRows.length} matching products</p>
            </div>
            <div className={`rounded-full px-3 py-1 text-sm font-semibold ${meta.tone === "amber" ? "bg-amber-100 text-amber-800" : meta.tone === "red" ? "bg-red-100 text-red-700" : meta.tone === "slate" ? "bg-slate-100 text-slate-700" : "bg-emerald-100 text-emerald-700"}`}>
              {meta.label}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 p-4">
          <form className="flex flex-wrap items-center gap-2" method="get" action={`/admin/reports/stock/status/${meta.slug}`}>
            <label className="text-sm text-slate-600">
              <span className="mr-2">Shop</span>
              <select name="shopId" defaultValue={selectedShopId} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                <option value="">All shops</option>
                {data.shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>{shop.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              <span className="mr-2">Category</span>
              <select name="categoryId" defaultValue={selectedCategoryId} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                <option value="">All categories</option>
                {data.categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <Button type="submit" size="sm" variant="secondary">
              Filter
            </Button>
            {(selectedShopId || selectedCategoryId) ? (
              <Button as={Link} href={`/admin/reports/stock/status/${meta.slug}`} size="sm" variant="ghost">
                Clear
              </Button>
            ) : null}
          </form>
        </div>

        {filteredRows.length ? (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Shop</th>
                  <th>SKU</th>
                  <th>Quantity</th>
                  <th>Reorder</th>
                  <th>Critical</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                          <Package2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold">{row.product?.name ?? "Unknown product"}</p>
                          <p className="text-xs text-slate-500">{row.product?.sku ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-500" />
                        <span>{row.shop?.name ?? "Unknown shop"}</span>
                      </div>
                    </td>
                    <td>{row.product?.sku ?? "—"}</td>
                    <td className="font-semibold">{row.quantity}</td>
                    <td>{row.reorderLevel}</td>
                    <td>{row.criticalLevel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No matching products" description="There are no products in this stock status for the current business view." />
        )}
      </Card>
    </>
  );
}
