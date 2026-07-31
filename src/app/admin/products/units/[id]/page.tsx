import Link from "next/link";
import { requireAdmin } from "@/lib/rbac";
import { getAdminUnitById } from "@/services/admin/product-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProductUnitAction } from "@/actions/admin/product-actions";
import { deleteProductUnitAction } from "@/actions/admin/product-actions";

export const dynamic = "force-dynamic";

export default async function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const unit = await getAdminUnitById(user.businessId, id);
  if (!unit) return <p className="p-6">Unit not found.</p>;

  return (
    <>
      <PageHeading title={unit.name} description={`Symbol: ${unit.symbol}`} />
      <div className="mb-4">
        <Link href="/admin/products/units" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Back to list
        </Link>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="#edit-unit" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Edit
        </Link>
        <form action={deleteProductUnitAction} className="inline">
          <input type="hidden" name="id" value={unit.id} />
          <Button variant="danger">Delete</Button>
        </form>
      </div>
      <div className="grid gap-5">
        <Card>
          <CardHeader><h2 className="font-extrabold">Edit unit</h2></CardHeader>
          <CardContent>
            <form id="edit-unit" action={updateProductUnitAction} className="space-y-3">
              <input type="hidden" name="id" value={unit.id} />
              <Input name="name" defaultValue={unit.name} placeholder="Unit name" required />
              <Input name="symbol" defaultValue={unit.symbol} placeholder="Symbol" required />
              <Button className="w-full">Save unit</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
