import { requireAdmin } from "@/lib/rbac";
import { createProductBrandAction } from "@/actions/admin/product-actions";
import { listAdminProductBrands } from "@/services/admin/product-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

export const dynamic = "force-dynamic";

type ProductBrandsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductBrandsPage({ searchParams }: ProductBrandsPageProps) {
  const user = await requireAdmin();
  const brands = await listAdminProductBrands(user.businessId);
  const resolvedSearchParams = (await searchParams) ?? {};
  const error = typeof resolvedSearchParams.error === "string" ? decodeURIComponent(resolvedSearchParams.error) : "";

  return (
    <>
      <PageHeading title="Product brands" description="Create and manage brands available for products." />
      <div className="flex flex-wrap gap-2 mb-4">
        <Link href="/admin/products/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          New product
        </Link>
        <Link href="/admin/products/categories" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Categories
        </Link>
        <Link href="/admin/products/units" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Units
        </Link>
        <Link href="/admin/products/brands/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          New brand
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Create brand</h2>
              <p className="text-sm text-slate-500">Brands appear on products and help identify their manufacturer or label.</p>
            </div>
          </CardHeader>
          <CardContent>
            <form action={createProductBrandAction} className="space-y-3">
              <Input name="name" placeholder="Brand name" required />
              <Button className="w-full" variant={error ? "danger" : "primary"}>Create brand</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Existing brands</h2>
              <p className="text-sm text-slate-500">Brands can be selected when creating or editing products.</p>
            </div>
          </CardHeader>
          {brands.length ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {brands.map((brand) => (
                    <tr key={brand.id}>
                      <td>{brand.name}</td>
                      <td>{brand.isActive ? "Active" : "Inactive"}</td>
                      <td>
                        <Link href={`/admin/products/brands/${brand.id}`} className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No brands yet" description="Create product brands here so they can be selected when adding products." />
          )}
        </Card>
      </div>
    </>
  );
}
