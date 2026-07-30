import { requireAdmin } from "@/lib/rbac";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createShopAction } from "@/actions/admin/shop-actions";

export const dynamic = "force-dynamic";

export default async function NewShopPage() {
  await requireAdmin();

  return (
    <>
      <PageHeading title="Create shop" description="Create a new physical location and its login account." />
      <Card>
        <CardHeader><h2 className="font-extrabold">New shop</h2></CardHeader>
        <CardContent>
          <form action={createShopAction} className="space-y-3">
            <Input name="name" placeholder="Shop name" required />
            <Input name="code" placeholder="Unique code, e.g. NBI-CBD" required />
            <Input name="email" type="email" placeholder="Shop login email" required />
            <Input name="password" type="password" minLength={8} placeholder="Temporary password" required />
            <Input name="phone" placeholder="Phone (optional)" />
            <textarea name="address" placeholder="Physical address" className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500" />
            <Button className="w-full">Create shop and account</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
