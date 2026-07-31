import { requireAdmin } from "@/lib/rbac";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createProductUnitAction } from "@/actions/admin/product-actions";

export const dynamic = "force-dynamic";

export default async function NewUnitPage() {
  await requireAdmin();
  return (
    <>
      <PageHeading title="Create unit" description="Add a new product unit." />
      <Card>
        <CardHeader><h2 className="font-extrabold">New unit</h2></CardHeader>
        <CardContent>
          <form action={createProductUnitAction} className="space-y-3">
            <Input name="name" placeholder="Unit name" required />
            <Input name="symbol" placeholder="Symbol (e.g. pcs, kg)" required />
            <Button className="w-full">Create unit</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
