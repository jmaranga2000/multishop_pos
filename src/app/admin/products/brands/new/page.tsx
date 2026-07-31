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
