import Link from "next/link";
import { requireAdmin } from "@/lib/rbac";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { createShopAction } from "@/actions/admin/shop-actions";

export const dynamic = "force-dynamic";

export default async function NewShopPage() {
  await requireAdmin();

  return (
    <>
      <PageHeading title="Create shop" description="Create a new physical location and its login account." />
      <div className="mb-4">
        <Link href="/admin/shops" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Back to list
        </Link>
      </div>
      <Card>
        <CardHeader><h2 className="font-extrabold">New shop</h2></CardHeader>
        <CardContent>
          <form action={createShopAction} className="space-y-3">
            <Input name="name" placeholder="Shop name" required />
            <Input name="code" placeholder="Optional — leave blank to auto-generate (e.g. NBI-CBD)" />
            <p className="text-xs text-slate-500">Leave blank to auto-generate a unique shop code.</p>
            <Input name="email" type="email" placeholder="Shop login email" required />
            <PasswordInput name="password" minLength={8} placeholder="Temporary password" required />
              <PasswordInput name="counterPin" inputMode="numeric" placeholder="Unique 6-digit Counter 1 PIN" minLength={6} maxLength={6} pattern="[0-9]{6}" required />
            <Input name="phone" placeholder="Phone (optional)" />
            <textarea name="address" placeholder="Physical address" className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500" />
            <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
              Counter 1 and Register 1 are created automatically. The counter PIN identifies this terminal; manage additional counters from the Physical counters module.
            </p>
            <Button className="w-full">Create shop and account</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
