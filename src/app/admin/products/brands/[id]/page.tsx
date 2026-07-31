import Link from "next/link";
import { requireAdmin } from "@/lib/rbac";
import { getAdminBrandById } from "@/services/admin/product-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProductBrandAction } from "@/actions/admin/product-actions";
import { toggleProductBrandAction, deleteProductBrandAction } from "@/actions/admin/product-actions";

export const dynamic = "force-dynamic";

export default async function BrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const brand = await getAdminBrandById(user.businessId, id);
  if (!brand) return <p className="p-6">Brand not found.</p>;

  return (
    <>
      <PageHeading title={brand.name} description="Product brand" />
      <div className="mb-4">
        <Link href="/admin/products/brands" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Back to list
        </Link>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="#edit-brand" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Edit
        </Link>
        <form action={deleteProductBrandAction} className="inline">
          <input type="hidden" name="id" value={brand.id} />
          <Button variant="danger">Delete</Button>
        </form>
      </div>
      <div className="grid gap-5">
        <Card>
          <CardHeader><h2 className="font-extrabold">Edit brand</h2></CardHeader>
          <CardContent>
            <form id="edit-brand" action={updateProductBrandAction} className="space-y-3">
              <input type="hidden" name="id" value={brand.id} />
              <Input name="name" defaultValue={brand.name} placeholder="Brand name" required />
              <Button className="w-full">Save brand</Button>
            </form>
            <div className="mt-3 flex gap-2">
              <form action={toggleProductBrandAction} className="inline">
                <input type="hidden" name="id" value={brand.id} />
                <input type="hidden" name="isActive" value={!brand.isActive ? "true" : "false"} />
                <Button variant={brand.isActive ? "secondary" : "primary"}>{brand.isActive ? "Suspend" : "Activate"}</Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
