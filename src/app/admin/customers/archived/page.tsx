import Link from "next/link";
import { Archive, User2, ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ArchivedCustomersPage() {
  const admin = await requireAdmin();

  const shops = await db.shop.findMany({
    where: { businessId: admin.businessId },
    select: { id: true },
  });

  const shopIds = shops.map((shop) => shop.id);

  const customers = await db.customer.findMany({
    where: {
      shopId: { in: shopIds },
      isArchived: true,
    },
    include: {
      shop: { select: { id: true, name: true, code: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeading title="Archived customers" description="Restore customers who have returned or are no longer active on credit." />

      <div className="mb-4">
        <Link href="/admin/customers">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back to customers
          </Button>
        </Link>
      </div>

      <div className="grid gap-5">
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Archived customers</h2>
              <p className="text-sm text-slate-500">These customers are hidden from the active customer list.</p>
            </div>
          </CardHeader>

          {customers.length ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Shop</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                    <th>Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                            <User2 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-bold">{customer.name}</p>
                            <p className="text-xs text-slate-500">{customer.phone ?? customer.email ?? "No contact details"}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="font-medium">{customer.shop?.name ?? "Unknown shop"}</p>
                        <p className="text-xs text-slate-500">{customer.shop?.code ?? ""}</p>
                      </td>
                      <td>{customer.cachedOutstandingMinor === 0 ? "KES 0.00" : `KES ${(customer.cachedOutstandingMinor / 100).toFixed(2)}`}</td>
                      <td>
                        <Badge tone="neutral">Archived</Badge>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <Link href={`/admin/customers/${customer.id}`}>
                            <Button size="sm" variant="secondary">View</Button>
                          </Link>
                          <Link href={`/admin/customers/${customer.id}/statement`}>
                            <Button size="sm" variant="secondary">Statement</Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No archived customers" description="Customers you archive will appear here." />
          )}
        </Card>
      </div>
    </>
  );
}
