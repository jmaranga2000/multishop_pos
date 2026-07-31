import { requireAdmin } from "@/lib/rbac";
import { getAdminCategoryById } from "@/services/admin/product-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProductCategoryAction } from "@/actions/admin/product-actions";
import { toggleProductCategoryAction, deleteProductCategoryAction } from "@/actions/admin/product-actions";

export const dynamic = "force-dynamic";

export default async function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const category = await getAdminCategoryById(user.businessId, id);
  if (!category) return <p className="p-6">Category not found.</p>;

  return (
    <>
      <PageHeading title={category.name} description={`Slug: ${category.slug}`} />
      <div className="grid gap-5">
        <Card>
          <CardHeader><h2 className="font-extrabold">Edit category</h2></CardHeader>
          <CardContent>
            <form action={updateProductCategoryAction} className="space-y-3">
              <input type="hidden" name="id" value={category.id} />
              <Input name="name" defaultValue={category.name} placeholder="Category name" required />
              <Button className="w-full">Save category</Button>
            </form>
            <div className="mt-3 flex gap-2">
              <form action={toggleProductCategoryAction} className="inline">
                <input type="hidden" name="id" value={category.id} />
                <input type="hidden" name="isActive" value={!category.isActive ? "true" : "false"} />
                <Button variant={category.isActive ? "secondary" : "primary"}>{category.isActive ? "Suspend" : "Activate"}</Button>
              </form>
              <form action={deleteProductCategoryAction} className="inline" onSubmit={(e) => { if (!confirm('Delete category? This cannot be undone.')) e.preventDefault(); }}>
                <input type="hidden" name="id" value={category.id} />
                <Button variant="danger">Delete</Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
