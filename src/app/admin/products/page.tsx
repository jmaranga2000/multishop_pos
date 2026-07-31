import Link from "next/link";
import { Package } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { listAdminProducts } from "@/services/admin/product-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const user = await requireAdmin();
  const { business, products } = await listAdminProducts(user.businessId);

  return (
    <>
      <PageHeading title="Product catalogue" description="Products are created centrally and receive separate stock records in every shop." />
      <div className="flex flex-wrap justify-end gap-2 mb-4">
        <Link href="/admin/products/categories" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Categories
        </Link>
        <Link href="/admin/products/brands" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Brands
        </Link>
        <Link href="/admin/products/units" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Units
        </Link>
        <Link href="/admin/products/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          New product
        </Link>
      </div>
      <div className="grid gap-5">
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Products</h2>
              <p className="text-sm text-slate-500">Products are shared catalog items with separate inventory in every shop.</p>
            </div>
          </CardHeader>
          {products.length ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU / barcode</th>
                    <th>Category</th>
                    <th>Default price</th>
                    <th>Shops</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-blue-50 p-2 text-blue-700"><Package className="h-4 w-4" /></div>
                          <div>
                            <p className="font-bold">{product.name}</p>
                            <p className="text-xs text-slate-500">{product.brand?.name ?? "Unbranded"} • {product.unit?.symbol ?? "unit"}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="font-mono text-xs">{product.sku}</p>
                        <p className="text-xs text-slate-500">{product.barcode ?? "No barcode"}</p>
                      </td>
                      <td>{product.category?.name ?? "Uncategorized"}</td>
                      <td className="font-bold">{formatMoney(product.defaultSellingPrice.toString(), business.currency)}</td>
                      <td>{product._count.inventory}</td>
                      <td><Badge tone={product.status === "ACTIVE" ? "success" : "neutral"}>{product.status}</Badge></td>
                      <td>
                        <Link href={`/admin/products/${product.id}`} className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="No products created" description="Create products here from the new product page." />}
        </Card>
      </div>
    </>
  );
}
