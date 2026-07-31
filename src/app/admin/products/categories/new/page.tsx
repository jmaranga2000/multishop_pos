import { requireAdmin } from "@/lib/rbac";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createProductCategoryAction } from "@/actions/admin/product-actions";

export const dynamic = "force-dynamic";

export default async function NewCategoryPage() {
  await requireAdmin();
  return (
    <>
      <PageHeading title="Create category" description="Add a new product category." />
      <Card>
        <CardHeader><h2 className="font-extrabold">New category</h2></CardHeader>
        <CardContent>
          <form action={createProductCategoryAction} className="space-y-3">
            <Input name="name" placeholder="Category name" required />
            <Button className="w-full">Create category</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
