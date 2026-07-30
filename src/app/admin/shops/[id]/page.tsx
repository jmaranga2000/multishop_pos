import { requireAdmin } from "@/lib/rbac";
import { getAdminShopById } from "@/services/admin/shop-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateShopAction } from "@/actions/admin/shop-actions";
import { Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ShopDetailsPage({ params }: { params: { id: string } }) {
  const user = await requireAdmin();
  const shop = await getAdminShopById(user.businessId, params.id);
  if (!shop) return <p className="p-6">Shop not found.</p>;

  return (
    <>
      <PageHeading title={shop.name} description={`Code: ${shop.code}`} />
      <div className="grid gap-5">
        <Card>
          <CardHeader><h2 className="font-extrabold">Details</h2></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><Building2 className="h-6 w-6" /></div>
              <div>
                <p className="font-bold text-lg">{shop.name} <Badge tone={shop.isActive ? "success" : "danger"} className="ml-2">{shop.isActive ? "Active" : "Suspended"}</Badge></p>
                <p className="text-sm text-slate-500">{shop.code} • {shop.phone ?? "No phone"}</p>
                <p className="text-sm text-slate-500">{shop.address ?? "No address"}</p>
                <p className="mt-2 text-sm">Account: {shop.account?.email ?? "No account"}</p>
                <p className="text-sm">Inventory: {shop._count.inventory} items</p>
                <p className="text-sm">Sales: {shop._count.sales}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="font-extrabold">Edit shop</h2></CardHeader>
          <CardContent>
            <form action={updateShopAction} className="space-y-3">
              <input type="hidden" name="shopId" value={shop.id} />
              <Input name="name" defaultValue={shop.name} placeholder="Shop name" required />
              <Input name="code" defaultValue={shop.code} placeholder="Unique code" required />
              <Input name="email" defaultValue={shop.account?.email ?? shop.email ?? ""} type="email" placeholder="Login email (optional)" />
              <Input name="password" type="password" placeholder="New temporary password (leave blank to keep)" />
              <Input name="phone" defaultValue={shop.phone ?? ""} placeholder="Phone (optional)" />
              <textarea name="address" defaultValue={shop.address ?? ""} placeholder="Physical address" className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500" />
              <div className="flex gap-2">
                <Button className="w-full">Save changes</Button>
                <a href="/admin/shops" className="btn secondary">Back</a>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
