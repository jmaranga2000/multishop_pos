import Link from "next/link";
import { requireAdmin } from "@/lib/rbac";
import { getAdminShopById } from "@/services/admin/shop-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShopEditForm } from "@/components/admin/shop-edit-form";
import { Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ShopDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const shop = await getAdminShopById(user.businessId, id);
  if (!shop) return <p className="p-6">Shop not found.</p>;

  return (
    <>
      <PageHeading title={shop.name} description={`Code: ${shop.code}`} />
      <div className="mb-4">
        <Link href="/admin/shops" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Back to list
        </Link>
      </div>
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
            <ShopEditForm shop={{ ...shop, registers: shop.registers.map((register) => ({ id: register.id, name: register.name, code: register.code, isActive: register.isActive })) }} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
