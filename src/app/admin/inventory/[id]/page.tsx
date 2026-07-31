import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { getInventoryManagementData } from "@/services/admin/inventory-service";
import { adjustStockAction, updateInventoryAction } from "@/actions/admin/inventory-actions";
import { InventoryDuplicateGuard as ClientInventoryDuplicateGuard } from "@/components/admin/inventory-duplicate-guard";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney, getStockStatus } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const { business, shops, products, inventory } = await getInventoryManagementData(user.businessId);
  const item = inventory.find((entry) => entry.id === id);

  if (!item) return <p className="p-6">Inventory record not found.</p>;

  const status = getStockStatus(item.quantity, item.reorderLevel, item.criticalLevel);

  return (
    <>
      <PageHeading title={item.product.name} description={`Shop: ${item.shop.name}`} />
      <div className="mb-4">
        <Link href="/admin/inventory" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Back to list
        </Link>
      </div>
      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Inventory details</h2>
              <p className="text-sm text-slate-500">Per-shop stock record with pricing and threshold information.</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Product</p>
                <p className="mt-1 font-bold">{item.product.name}</p>
                <p className="text-sm text-slate-500">{item.product.sku}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Shop</p>
                <p className="mt-1 font-bold">{item.shop.name}</p>
                <p className="text-sm text-slate-500">{item.shop.code}</p>
              </div>
              <form action={updateInventoryAction} className="grid gap-3 md:grid-cols-2">
                <input type="hidden" name="inventoryId" value={item.id} />
                <ClientInventoryDuplicateGuard shops={shops} products={products} item={item} inventory={inventory} />
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Quantity</p>
                  <input name="quantity" type="number" defaultValue={item.quantity} className="mt-1 w-full rounded-md border px-2 py-2 text-sm" />
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                  <div className="mt-1">
                    <Badge tone={status === "IN_STOCK" ? "success" : status === "LOW_STOCK" ? "warning" : "danger"}>{status.replaceAll("_", " ")}</Badge>
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Selling price</p>
                  <input name="sellingPrice" type="number" step="0.01" defaultValue={Number(item.sellingPrice)} className="mt-1 w-full rounded-md border px-2 py-2 text-sm" />
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Cost price</p>
                  <input name="costPrice" type="number" step="0.01" defaultValue={Number(item.costPrice)} className="mt-1 w-full rounded-md border px-2 py-2 text-sm" />
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Reorder level</p>
                  <input name="reorderLevel" type="number" defaultValue={item.reorderLevel} className="mt-1 w-full rounded-md border px-2 py-2 text-sm" />
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Critical level</p>
                  <input name="criticalLevel" type="number" defaultValue={item.criticalLevel} className="mt-1 w-full rounded-md border px-2 py-2 text-sm" />
                </div>
                <div className="rounded-xl bg-slate-50 p-4 md:col-span-2">
                  <label className="inline-flex items-center gap-2"><input type="checkbox" name="isAvailable" defaultChecked={item.isAvailable} /> <span className="text-sm">Available for sale</span></label>
                </div>
                <div className="md:col-span-2">
                  <div className="flex gap-2">
                    <Button id="inventory-save-btn" type="submit" className="w-full">Save changes</Button>
                    <Link href="/admin/inventory" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">Cancel</Link>
                  </div>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Adjust stock</h2>
              <p className="text-sm text-slate-500">Update the current quantity and keep the audit trail in sync.</p>
            </div>
          </CardHeader>
          <CardContent>
            <form action={adjustStockAction} className="space-y-3">
              <input type="hidden" name="inventoryId" value={item.id} />
              <Input name="quantity" type="number" min="0" defaultValue={item.quantity} placeholder="New quantity" required />
              <Input name="reason" placeholder="Adjustment reason" required />
              <Button className="w-full"><SlidersHorizontal className="h-4 w-4" />Save adjustment</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
