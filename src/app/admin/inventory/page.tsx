import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { addStockAction, adjustStockAction } from "@/actions/admin/inventory-actions";
import { getInventoryManagementData } from "@/services/admin/inventory-service";
import { StockMovementForm } from "@/components/admin/stock-movement-form";
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
  const inventoryByShop = inventory.reduce((map, item) => {
    const shopInventory = map.get(item.shop.id) ?? [];
    shopInventory.push(item);
    map.set(item.shop.id, shopInventory);
    return map;
  }, new Map<string, typeof inventory>());
  const shopsWithInventory = shops.filter((shop) => inventoryByShop.has(shop.id));

  return (
    <>
      <PageHeading title="Shop inventory" description="Every product and shop combination has an independent quantity, price and threshold." />
      <div className="mb-4 flex justify-end">
        <Link href="/admin/inventory/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          New stock movement
        </Link>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
        <Card className="overflow-hidden">
          <CardHeader><div><h2 className="font-extrabold">Current stock</h2><p className="text-sm text-slate-500">{inventory.length} inventory records across {shops.length} shops.</p></div></CardHeader>
          {inventory.length ? (
            <div className="space-y-8 p-4">
              {shopsWithInventory.map((shop) => {
                const shopInventory = inventoryByShop.get(shop.id) ?? [];
                return (
                  <div key={shop.id}>
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold">{shop.name}</h3>
                        <p className="text-sm text-slate-500">{shopInventory.length} inventory record{shopInventory.length === 1 ? "" : "s"}</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="data-table w-full">
                        <thead>
                          <tr><th>Product</th><th>Quantity</th><th>Thresholds</th><th>Selling price</th><th>Status</th><th>Adjust</th></tr>
                        </thead>
                        <tbody>
                          {shopInventory.map((item) => {
                            const status = getStockStatus(item.quantity, item.reorderLevel, item.criticalLevel);
                            const productName = item.product?.name ?? "Unknown product";
                            const productSku = item.product?.sku ?? "No SKU";
                            const productBrand = item.product?.brand?.name;
                            return (
                              <tr key={item.id}>
                                <td>
                                  <p className="font-bold">{productName}</p>
                                  <p className="text-xs text-slate-500">{productSku}{productBrand ? ` • ${productBrand}` : ""}</p>
                                </td>
                                <td className="font-black">{item.quantity}</td>
                                <td><p className="text-xs">Reorder: {item.reorderLevel}</p><p className="text-xs text-slate-500">Critical: {item.criticalLevel}</p></td>
                                <td>{formatMoney(item.sellingPrice.toString(), business.currency)}</td>
                                <td><Badge tone={status === "IN_STOCK" ? "success" : status === "LOW_STOCK" ? "warning" : "danger"}>{status.replaceAll("_", " ")}</Badge></td>
                                <td>
                                  <div className="flex flex-col gap-2">
                                    <Link href={`/admin/inventory/${item.id}`} className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">View</Link>
                                    <form action={adjustStockAction} className="flex min-w-72 gap-2">
                                      <input type="hidden" name="inventoryId" value={item.id} />
                                      <Input name="quantity" type="number" min="0" defaultValue={item.quantity} className="w-24" required />
                                      <Input name="reason" placeholder="Adjustment reason" required />
                                      <Button size="sm" variant="secondary"><SlidersHorizontal className="h-4 w-4" />Save</Button>
                                    </form>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <EmptyState title="No shop stock" description="Add stock to assign a product to a shop." />}
        </Card>

        <Card>
          <CardHeader><div><h2 className="font-extrabold">Add or restock</h2><p className="text-sm text-slate-500">Creates an inventory ledger movement and resolves restored alerts.</p></div></CardHeader>
          <CardContent>
            <StockMovementForm shops={shops} products={products} action={addStockAction} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
