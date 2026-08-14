import Link from "next/link";
import { requireAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCustomerAction } from "@/actions/admin/customer-actions";

export const dynamic = "force-dynamic";

export default async function NewAdminCustomerPage() {
  const admin = await requireAdmin();
  const shops = await db.shop.findMany({
    where: { businessId: admin.businessId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4">
          <Link href="/admin/customers">
            <Button variant="secondary" size="sm">Back to customers</Button>
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Create customer</h1>
          <p className="mt-1 text-sm text-slate-600">Add a customer under one of your shops.</p>

          <form action={createCustomerAction} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Shop</label>
              <select
                name="shopId"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                required
              >
                <option value="">Select a shop</option>
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>{shop.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Customer name</label>
              <Input name="name" placeholder="e.g. Jane Kamau" required />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                <Input name="phone" type="tel" placeholder="Optional" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <Input name="email" type="email" placeholder="Optional" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Credit limit</label>
              <Input
                name="creditLimitMinor"
                type="number"
                min={0}
                step={1}
                defaultValue={0}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-slate-500">Value is stored in minor units (for example 1000 = KES 10.00).</p>
            </div>

            <Button className="w-full">Create customer</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
