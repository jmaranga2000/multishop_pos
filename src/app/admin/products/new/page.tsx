import Link from "next/link";
import { requireAdmin } from "@/lib/rbac";
import { getProductManagementData } from "@/services/admin/product-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProductCreateForm } from "@/components/admin/product-create-form";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const user = await requireAdmin();
  const { categories, brands, units } = await getProductManagementData(user.businessId);

  return (
    <>
      <PageHeading title="Create product" description="Add a product to the catalog before assigning stock to shops." />
      <div className="mb-4">
        <Link href="/admin/products" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Back to list
        </Link>
      </div>
      <Card>
        <CardHeader>
          <div>
            <h2 className="font-extrabold">New product</h2>
            <p className="text-sm text-slate-500">Products are used across all shops and maintain separate inventory per location.</p>
          </div>
        </CardHeader>
        <CardContent>
          <ProductCreateForm categories={categories} brands={brands} units={units} />
        </CardContent>
      </Card>
    </>
  );
}
