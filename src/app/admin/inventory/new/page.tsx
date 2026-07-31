import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { addStockAction } from "@/actions/admin/inventory-actions";
import { getInventoryManagementData } from "@/services/admin/inventory-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NewInventoryPage() {
  const user = await requireAdmin();
  const { shops, products } = await getInventoryManagementData(user.businessId);

  return (
    <>
      <PageHeading title="Create stock movement" description="Add inventory for a product and shop combination." />
      <div className="mb-4">
        <Link href="/admin/inventory" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Back to list
        </Link>
      </div>
      <Card>
        <CardHeader>
          <div>
            <h2 className="font-extrabold">New stock movement</h2>
            <p className="text-sm text-slate-500">Creates a ledger entry and refreshes stock alerts.</p>
          </div>
        </CardHeader>
        <CardContent>
          <form action={addStockAction} className="space-y-3">
            <select name="shopId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">Select shop</option>
              {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
            </select>
            <select name="productId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">Select product</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}
            </select>
            <Input name="quantity" type="number" min="1" placeholder="Quantity to add" required />
            <div className="grid grid-cols-2 gap-3">
              <Input name="costPrice" type="number" min="0" step="0.01" placeholder="Cost price" required />
              <Input name="sellingPrice" type="number" min="0.01" step="0.01" placeholder="Selling price" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input name="reorderLevel" type="number" min="0" defaultValue="10" placeholder="Reorder level" required />
              <Input name="criticalLevel" type="number" min="0" defaultValue="5" placeholder="Critical level" required />
            </div>
            <Button className="w-full"><Plus className="h-4 w-4" />Save stock movement</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
