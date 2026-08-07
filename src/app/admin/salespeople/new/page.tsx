import Link from "next/link";
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
  const { shops, registers } = await getSalespersonManagementData((await requireAdmin()).businessId);

  return (
    <>
      <PageHeading title="Create salesperson" description="Create a managed PIN profile for a shop operator." />
      <div className="mb-4">
        <Link href="/admin/salespeople" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Back to list
        </Link>
      </div>
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
            <select name="registerId" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">No specific counter</option>
              {registers.map((register) => (
                <option key={register.id} value={register.id}>{register.shop?.name ?? "Shop"} • {register.name}</option>
              ))}
            </select>
            <Input name="pin" type="password" inputMode="numeric" pattern="[0-9]{4,6}" placeholder="4–6 digit PIN" required />
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              After creating the salesperson, open their profile to enroll fingerprint authentication from the edit form.
            </div>
            <Button className="w-full">Create profile</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
