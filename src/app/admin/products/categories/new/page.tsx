import Link from "next/link";
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
      <div className="mb-4">
        <Link href="/admin/products/categories" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Back to list
        </Link>
      </div>
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
