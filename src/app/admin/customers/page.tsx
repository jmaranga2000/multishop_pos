import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatMoney, fromMinorUnits } from "@/lib/utils";
import { CustomerSearchClient } from "@/components/admin/customer-search-client";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage(props: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requireAdmin();
  const searchParams = await props.searchParams;
  const query = searchParams.q ?? "";

  const customers = await db.customer.findMany({
    where: {
      shop: {
        businessId: admin.businessId,
      },
      ...(query ? { name: { contains: query } } : {}),
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  return (
    <div className="p-6 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Customers (Admin)</h1>
          <div className="flex gap-2">
            <Link href="/admin/credit">
              <Button variant="secondary">Credit Dashboard</Button>
            </Link>
            <Link href="/admin/customers/new">
              <Button>Create Customer</Button>
            </Link>
          </div>
        </div>

        <CustomerSearchClient initialCustomers={customers} initialQuery={query} />
      </div>
    </div>
  );
}
