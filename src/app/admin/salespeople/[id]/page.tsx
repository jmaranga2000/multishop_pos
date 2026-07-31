import Link from "next/link";
import { UserRoundCheck } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { getAdminSalespersonById } from "@/services/admin/salesperson-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SalespersonEditForm } from "@/components/admin/salesperson-edit-form";

export const dynamic = "force-dynamic";

export default async function SalespersonDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const salesperson = await getAdminSalespersonById(user.businessId, id);

  if (!salesperson) return <p className="p-6">Salesperson profile not found.</p>;

  return (
    <>
      <PageHeading title={salesperson.name} description={`Code: ${salesperson.code}`} />
      <div className="mb-4">
        <Link href="/admin/salespeople" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Back to list
        </Link>
      </div>
      <div className="grid gap-5">
        <Card>
          <CardHeader><h2 className="font-extrabold">Details</h2></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><UserRoundCheck className="h-6 w-6" /></div>
              <div>
                <p className="font-bold text-lg">{salesperson.name} <Badge tone={salesperson.isActive ? "success" : "danger"} className="ml-2">{salesperson.isActive ? "Active" : "Inactive"}</Badge></p>
                <p className="text-sm text-slate-500">{salesperson.shop.name} • {salesperson.code}</p>
                <p className="text-sm">Sales: {salesperson._count.sales}</p>
                <p className="text-sm">Sessions: {salesperson._count.sessions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="font-extrabold">Edit salesperson</h2></CardHeader>
          <CardContent>
            <SalespersonEditForm
              salesperson={{
                id: salesperson.id,
                name: salesperson.name,
                code: salesperson.code,
                shopName: salesperson.shop?.name ?? null,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
