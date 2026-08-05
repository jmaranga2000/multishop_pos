import { requireAdmin } from "@/lib/rbac";
import { createProductCategoryAction } from "@/actions/admin/product-actions";
import { listAdminProductCategories } from "@/services/admin/product-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

export const dynamic = "force-dynamic";

type ProductCategoriesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductCategoriesPage({ searchParams }: ProductCategoriesPageProps) {
  const user = await requireAdmin();
  const categories = await listAdminProductCategories(user.businessId);
  const resolvedSearchParams = (await searchParams) ?? {};
  const error = typeof resolvedSearchParams.error === "string" ? decodeURIComponent(resolvedSearchParams.error) : "";

  return (
    <>
      <PageHeading title="Product categories" description="Create and manage categories used to organize products." />
      <div className="flex flex-wrap gap-2 mb-4">
        <Link href="/admin/products/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          New product
        </Link>
        <Link href="/admin/products/brands" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Brands
        </Link>
        <Link href="/admin/products/units" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Units
        </Link>
        <Link href="/admin/products/categories/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          New category
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
              <h2 className="font-extrabold">Create category</h2>
              <p className="text-sm text-slate-500">Categories help you organize products for reporting and filtering.</p>
            </div>
          </CardHeader>
          <CardContent>
            <form action={createProductCategoryAction} className="space-y-3">
              <Input name="name" placeholder="Category name" required />
              <Button className="w-full" variant={error ? "danger" : "primary"}>Create category</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Existing categories</h2>
              <p className="text-sm text-slate-500">Categories can be assigned when creating or editing products.</p>
            </div>
          </CardHeader>
          {categories.length ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td>{category.name}</td>
                      <td className="font-mono text-xs text-slate-500">{category.slug}</td>
                          <td>{category.isActive ? "Active" : "Inactive"}</td>
                          <td>
                            <Link href={`/admin/products/categories/${category.id}`} className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">
                              View
                            </Link>
                          </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No categories yet" description="Create product categories here so they can be selected when adding products." />
          )}
        </Card>
      </div>
    </>
  );
}
