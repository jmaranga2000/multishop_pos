import { Plus, SlidersHorizontal } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { addStockAction, adjustStockAction } from "@/actions/admin/inventory-actions";
import { getInventoryManagementData } from "@/services/admin/inventory-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney, getStockStatus } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const user = await requireAdmin();
  const { business, inventory, shops, products } = await getInventoryManagementData(user.businessId);

  return (
    <>
      <PageHeading title="Shop inventory" description="Every product and shop combination has an independent quantity, price and threshold." />
      <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
        <Card className="overflow-hidden">
          <CardHeader><div><h2 className="font-extrabold">Current stock</h2><p className="text-sm text-slate-500">{inventory.length} inventory records across {shops.length} shops.</p></div></CardHeader>
          {inventory.length ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Product</th><th>Shop</th><th>Quantity</th><th>Thresholds</th><th>Selling price</th><th>Status</th><th>Adjust</th></tr></thead>
                <tbody>
                  {inventory.map((item) => {
                    const status = getStockStatus(item.quantity, item.reorderLevel, item.criticalLevel);
                    return (
                      <tr key={item.id}>
                        <td><p className="font-bold">{item.product.name}</p><p className="text-xs text-slate-500">{item.product.sku}</p></td>
                        <td>{item.shop.name}</td>
                        <td className="font-black">{item.quantity}</td>
                        <td><p className="text-xs">Reorder: {item.reorderLevel}</p><p className="text-xs text-slate-500">Critical: {item.criticalLevel}</p></td>
                        <td>{formatMoney(item.sellingPrice.toString(), business.currency)}</td>
                        <td><Badge tone={status === "IN_STOCK" ? "success" : status === "LOW_STOCK" ? "warning" : "danger"}>{status.replaceAll("_", " ")}</Badge></td>
                        <td>
                          <form action={adjustStockAction} className="flex min-w-72 gap-2">
                            <input type="hidden" name="inventoryId" value={item.id} />
                            <Input name="quantity" type="number" min="0" defaultValue={item.quantity} className="w-24" required />
                            <Input name="reason" placeholder="Adjustment reason" required />
                            <Button size="sm" variant="secondary"><SlidersHorizontal className="h-4 w-4" />Save</Button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="No shop stock" description="Add stock to assign a product to a shop." />}
        </Card>

        <Card>
          <CardHeader><div><h2 className="font-extrabold">Add or restock</h2><p className="text-sm text-slate-500">Creates an inventory ledger movement and resolves restored alerts.</p></div></CardHeader>
          <CardContent>
            <form action={addStockAction} className="space-y-3">
              <select name="shopId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Select shop</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select>
              <select name="productId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}</select>
              <Input name="quantity" type="number" min="1" placeholder="Quantity to add" required />
              <div className="grid grid-cols-2 gap-3"><Input name="costPrice" type="number" min="0" step="0.01" placeholder="Cost price" required /><Input name="sellingPrice" type="number" min="0.01" step="0.01" placeholder="Selling price" required /></div>
              <div className="grid grid-cols-2 gap-3"><Input name="reorderLevel" type="number" min="0" defaultValue="10" placeholder="Reorder level" required /><Input name="criticalLevel" type="number" min="0" defaultValue="5" placeholder="Critical level" required /></div>
              <Button className="w-full"><Plus className="h-4 w-4" />Save stock movement</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
