import { Package, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { createProductAction } from "@/actions/admin/product-actions";
import { getProductManagementData } from "@/services/admin/product-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const user = await requireAdmin();
  const { categories, brands, units } = await getProductManagementData(user.businessId);

  return (
    <>
      <PageHeading title="Create product" description="Add a product to the catalog before assigning stock to shops." />
      <Card>
        <CardHeader>
          <div>
            <h2 className="font-extrabold">New product</h2>
            <p className="text-sm text-slate-500">Products are used across all shops and maintain separate inventory per location.</p>
          </div>
        </CardHeader>
        <CardContent>
          <form action={createProductAction} className="space-y-3">
            <Input name="name" placeholder="Product name" required />
            <Input name="sku" placeholder="Unique SKU" required />
            <Input name="barcode" placeholder="Barcode (optional)" />
            <div className="flex items-center gap-2">
              <select name="categoryId" className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">Select category</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
              </select>
              <a href="/admin/products/categories/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">New</a>
            </div>
            <div className="flex items-center gap-2">
              <select name="brandId" className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">Select brand</option>
              {brands.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
              </select>
              <a href="/admin/products/brands/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">New</a>
            </div>
            <div className="flex items-center gap-2">
              <select name="unitId" className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">Select unit</option>
              {units.map((item) => (
                <option key={item.id} value={item.id}>{item.name} ({item.symbol})</option>
              ))}
              </select>
              <a href="/admin/products/units/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">New</a>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input name="defaultCostPrice" type="number" min="0" step="0.01" placeholder="Cost price" required />
              <Input name="defaultSellingPrice" type="number" min="0.01" step="0.01" placeholder="Selling price" required />
            </div>
            <Button className="w-full"><Plus className="h-4 w-4" />Create product</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
