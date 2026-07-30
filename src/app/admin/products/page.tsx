import { Package, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { createProductAction } from "@/actions/admin/product-actions";
import { getProductManagementData } from "@/services/admin/product-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const user = await requireAdmin();
  const { business, products, categories, brands, units } = await getProductManagementData(user.businessId);

  return (
    <>
      <PageHeading title="Product catalogue" description="Products are created centrally and receive separate stock records in every shop." />
      <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
        <Card className="overflow-hidden">
          <CardHeader><h2 className="font-extrabold">Products</h2></CardHeader>
          {products.length ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Product</th><th>SKU / barcode</th><th>Category</th><th>Default price</th><th>Shops</th><th>Status</th></tr></thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2 text-blue-700"><Package className="h-4 w-4" /></div><div><p className="font-bold">{product.name}</p><p className="text-xs text-slate-500">{product.brand?.name ?? "Unbranded"} • {product.unit?.symbol ?? "unit"}</p></div></div></td>
                      <td><p className="font-mono text-xs">{product.sku}</p><p className="text-xs text-slate-500">{product.barcode ?? "No barcode"}</p></td>
                      <td>{product.category?.name ?? "Uncategorized"}</td>
                      <td className="font-bold">{formatMoney(product.defaultSellingPrice.toString(), business.currency)}</td>
                      <td>{product._count.inventory}</td>
                      <td><Badge tone={product.status === "ACTIVE" ? "success" : "neutral"}>{product.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="No products created" description="Create products here, then add stock per shop from Inventory." />}
        </Card>
        <Card>
          <CardHeader><div><h2 className="font-extrabold">Create product</h2><p className="text-sm text-slate-500">This writes validated product data directly to MongoDB.</p></div></CardHeader>
          <CardContent>
            <form action={createProductAction} className="space-y-3">
              <Input name="name" placeholder="Product name" required />
              <Input name="sku" placeholder="Unique SKU" required />
              <Input name="barcode" placeholder="Barcode (optional)" />
              <select name="categoryId" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Select category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <select name="brandId" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Select brand</option>{brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <select name="unitId" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Select unit</option>{units.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.symbol})</option>)}</select>
              <div className="grid grid-cols-2 gap-3"><Input name="defaultCostPrice" type="number" min="0" step="0.01" placeholder="Cost price" required /><Input name="defaultSellingPrice" type="number" min="0.01" step="0.01" placeholder="Selling price" required /></div>
              <Button className="w-full"><Plus className="h-4 w-4" />Create product</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
