import Link from "next/link";
import { UserRoundCheck } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { getAdminSalespersonById, getSalespersonManagementData } from "@/services/admin/salesperson-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SalespersonEditForm } from "@/components/admin/salesperson-edit-form";

export const dynamic = "force-dynamic";

export default async function SalespersonDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const [{ salesperson }, { registers }] = await Promise.all([
    getAdminSalespersonById(user.businessId, id).then((result) => ({ salesperson: result })),
    getSalespersonManagementData(user.businessId),
  ]);

  const salespersonData = salesperson;

  if (!salespersonData) return <p className="p-6">Salesperson profile not found.</p>;

  return (
    <>
      <PageHeading title={salespersonData.name} description={`Code: ${salespersonData.code}`} />
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
                <p className="font-bold text-lg">{salespersonData.name} <Badge tone={salespersonData.isActive ? "success" : "danger"} className="ml-2">{salespersonData.isActive ? "Active" : "Inactive"}</Badge></p>
                <p className="text-sm text-slate-500">{salespersonData.shop.name} • {salespersonData.code}</p>
                <p className="text-sm">Counter: {salespersonData.register?.name ?? "No specific counter"}</p>
                <p className="text-sm">PIN profile: 4–6 digits, managed from the edit form below</p>
                <p className="text-sm">Sales: {salespersonData._count.sales}</p>
                <p className="text-sm">Sessions: {salespersonData._count.sessions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="font-extrabold">Edit salesperson</h2></CardHeader>
          <CardContent>
            <SalespersonEditForm
              salesperson={{
                id: salespersonData.id,
                name: salespersonData.name,
                code: salespersonData.code,
                shopName: salespersonData.shop?.name ?? null,
                registerId: salespersonData.register?.id ?? null,
                registerName: salespersonData.register?.name ?? null,
              }}
              registers={registers.map((register) => ({ id: register.id, name: register.name, shopName: register.shop?.name ?? null }))}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
