import { requireAdmin } from "@/lib/rbac";
import { createProductUnitAction } from "@/actions/admin/product-actions";
import { listAdminProductUnits } from "@/services/admin/product-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProductUnitsPage() {
  const user = await requireAdmin();
  const units = await listAdminProductUnits(user.businessId);

  return (
    <>
      <PageHeading title="Product units" description="Create and manage units used for product quantities." />
      <div className="flex flex-wrap gap-2 mb-4">
        <Link href="/admin/products/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          New product
        </Link>
        <Link href="/admin/products/categories" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Categories
        </Link>
        <Link href="/admin/products/brands" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Brands
        </Link>
        <Link href="/admin/products/units/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          New unit
        </Link>
      </div>

      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Create unit</h2>
              <p className="text-sm text-slate-500">Units define the quantity format displayed on products.</p>
            </div>
          </CardHeader>
          <CardContent>
            <form action={createProductUnitAction} className="space-y-3">
              <Input name="name" placeholder="Unit name" required />
              <Input name="symbol" placeholder="Symbol (e.g. pcs, kg, mL)" required />
              <Button className="w-full">Create unit</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Existing units</h2>
              <p className="text-sm text-slate-500">Units can be selected when creating or editing products.</p>
            </div>
          </CardHeader>
          {units.length ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Symbol</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((unit) => (
                    <tr key={unit.id}>
                      <td>{unit.name}</td>
                      <td>{unit.symbol}</td>
                      <td>
                        <Link href={`/admin/products/units/${unit.id}`} className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No units yet" description="Create product units here so they can be selected when adding products." />
          )}
        </Card>
      </div>
    </>
  );
}
