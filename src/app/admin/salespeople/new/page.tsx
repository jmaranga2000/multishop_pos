import { requireAdmin } from "@/lib/rbac";
import { getSalespersonManagementData } from "@/services/admin/salesperson-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createSalespersonAction } from "@/actions/admin/salesperson-actions";

export const dynamic = "force-dynamic";

export default async function NewSalespersonPage() {
  await requireAdmin();
  const { shops } = await getSalespersonManagementData((await requireAdmin()).businessId);

  return (
    <>
      <PageHeading title="Create salesperson" description="Create a managed PIN profile for a shop operator." />
      <Card>
        <CardHeader><h2 className="font-extrabold">New salesperson profile</h2></CardHeader>
        <CardContent>
          <form action={createSalespersonAction} className="space-y-3">
            <select name="shopId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">Select shop</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
            <Input name="name" placeholder="Full name" required />
            <Input name="code" placeholder="Short code, e.g. MARY01" required />
            <Input name="pin" type="password" inputMode="numeric" pattern="[0-9]{4,6}" placeholder="4–6 digit PIN" required />
            <Button className="w-full">Create profile</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
