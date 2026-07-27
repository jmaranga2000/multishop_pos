import { Building2, KeyRound, Plus, Power } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { createShopAction, resetShopPasswordAction, toggleShopAction } from "@/actions/admin/shop-actions";
import { listAdminShops } from "@/services/admin/shop-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function ShopsPage() {
  const user = await requireAdmin();
  const shops = await listAdminShops(user.businessId);

  return (
    <>
      <PageHeading title="Shops and login accounts" description="Create each physical location and issue one shared shop login." />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
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
                        <div className="flex min-w-72 flex-col gap-2">
                          {shop.account ? (
                            <form action={resetShopPasswordAction} className="flex gap-2">
                              <input type="hidden" name="userId" value={shop.account.id} />
                              <Input name="password" type="password" placeholder="New temporary password" minLength={8} required />
                              <Button size="sm" variant="secondary"><KeyRound className="h-4 w-4" />Reset</Button>
                            </form>
                          ) : null}
                          <form action={toggleShopAction}>
                            <input type="hidden" name="shopId" value={shop.id} />
                            <input type="hidden" name="isActive" value={String(!shop.isActive)} />
                            <Button size="sm" variant={shop.isActive ? "danger" : "success"} className="w-full">
                              <Power className="h-4 w-4" />{shop.isActive ? "Suspend shop" : "Activate shop"}
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="No shops yet" description="Use the creation form to add the first shop and login account." />}
        </Card>

        <Card>
          <CardHeader><div><h2 className="font-extrabold">Create shop</h2><p className="text-sm text-slate-500">The email and password become the shop credentials.</p></div></CardHeader>
          <CardContent>
            <form action={createShopAction} className="space-y-3">
              <Input name="name" placeholder="Shop name" required />
              <Input name="code" placeholder="Unique code, e.g. NBI-CBD" required />
              <Input name="email" type="email" placeholder="Shop login email" required />
              <Input name="password" type="password" minLength={8} placeholder="Temporary password" required />
              <Input name="phone" placeholder="Phone (optional)" />
              <textarea name="address" placeholder="Physical address" className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500" />
              <Button className="w-full"><Plus className="h-4 w-4" />Create shop and account</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
