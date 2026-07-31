import Link from "next/link";
import { requireAdmin } from "@/lib/rbac";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createProductBrandAction } from "@/actions/admin/product-actions";

export const dynamic = "force-dynamic";

export default async function NewBrandPage() {
  await requireAdmin();
  return (
    <>
      <PageHeading title="Create brand" description="Add a new product brand." />
      <div className="mb-4">
        <Link href="/admin/products/brands" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Back to list
        </Link>
      </div>
      <Card>
        <CardHeader><h2 className="font-extrabold">New brand</h2></CardHeader>
        <CardContent>
          <form action={createProductBrandAction} className="space-y-3">
            <Input name="name" placeholder="Brand name" required />
            <Button className="w-full">Create brand</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
