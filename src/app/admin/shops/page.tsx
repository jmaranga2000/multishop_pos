import { Building2, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { listAdminShops } from "@/services/admin/shop-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ArchiveButton from "@/components/admin/archive-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ShopsPage() {
  const user = await requireAdmin();
  const shops = await listAdminShops(user.businessId);

  return (
    <>
      <PageHeading title="Shops and login accounts" description="Create each physical location and issue one shared shop login." />
      <div className="flex justify-end mb-4">
        <Button href="/admin/shops/new"><Plus className="h-4 w-4" />New shop</Button>
      </div>
      <div className="grid gap-5">
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <h2 className="font-extrabold">All shops</h2>
              <p className="text-sm text-slate-500">Credentials remain isolated to their assigned location.</p>
            </div>
          </CardHeader>
          {shops.length ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Shop</th><th>Account</th><th>Inventory</th><th>Sales</th><th>Status</th><th>Account controls</th></tr></thead>
                <tbody>
                  {shops.map((shop) => (
                    <tr key={shop.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-blue-50 p-2 text-blue-700"><Building2 className="h-4 w-4" /></div>
                          <div><p className="font-bold">{shop.name}</p><p className="text-xs text-slate-500">{shop.code}</p></div>
                        </div>
                      </td>
                      <td><p className="text-sm">{shop.account?.email ?? "No account"}</p></td>
                      <td>{shop._count.inventory} products</td>
                      <td>{shop._count.sales}</td>
                      <td><Badge tone={shop.isActive ? "success" : "danger"}>{shop.isActive ? "Active" : "Suspended"}</Badge></td>
                      <td>
                        <div className="flex gap-2">
                          <a href={`/admin/shops/${shop.id}`} className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">View</a>
                          <ArchiveButton shopId={shop.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="No shops yet" description="Use the creation form to add the first shop and login account." />}
        </Card>

      </div>
    </>
  );
}
