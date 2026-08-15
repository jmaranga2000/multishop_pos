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
      shop: { businessId: admin.businessId },
      isArchived: false,
      ...(query ? { name: { contains: query } } : {}),
    },
    include: {
      shop: { select: { id: true, name: true, code: true } },
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  return (
    <div className="p-6 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Customers (Admin)</h1>
          <div className="flex flex-row flex-wrap items-center gap-2">
            <Link href="/admin/credit">
              <Button variant="secondary" className="whitespace-nowrap">Credit Dashboard</Button>
            </Link>
            <Link href="/admin/customers/archived">
              <Button variant="secondary" className="whitespace-nowrap">Archived Customers</Button>
            </Link>
            <Link href="/admin/customers/new">
              <Button className="whitespace-nowrap">Create Customer</Button>
            </Link>
          </div>
        </div>

        <CustomerSearchClient initialCustomers={customers} initialQuery={query} />
      </div>
    </div>
  );
}
