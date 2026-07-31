import Link from "next/link";
import { UserRoundCheck, UserRoundX } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { toggleSalespersonAction } from "@/actions/admin/salesperson-actions";
import { getSalespersonManagementData } from "@/services/admin/salesperson-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function SalespeoplePage() {
  const user = await requireAdmin();
  const { salespeople } = await getSalespersonManagementData(user.businessId);
  return (
    <>
      <PageHeading title="Salespeople" description="Optional PIN profiles identify the person operating a shared shop login." />
      <div className="mb-4 flex justify-end">
        <Link href="/admin/salespeople/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          New salesperson
        </Link>
      </div>
      <div className="grid gap-5">
        <Card className="overflow-hidden">
          <CardHeader><h2 className="font-extrabold">Salesperson profiles</h2></CardHeader>
          {salespeople.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Name</th><th>Shop</th><th>Code</th><th>Sales</th><th>Sessions</th><th>Status</th><th>Action</th></tr></thead><tbody>{salespeople.map((person) => <tr key={person.id}><td className="font-bold">{person.name}</td><td>{person.shop.name}</td><td className="font-mono text-xs">{person.code}</td><td>{person._count.sales}</td><td>{person._count.sessions}</td><td><Badge tone={person.isActive ? "success" : "danger"}>{person.isActive ? "Active" : "Inactive"}</Badge></td><td><div className="flex gap-2"><Link href={`/admin/salespeople/${person.id}`} className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">View</Link><form action={toggleSalespersonAction}><input type="hidden" name="salespersonId" value={person.id} /><input type="hidden" name="isActive" value={String(!person.isActive)} /><Button size="sm" variant={person.isActive ? "danger" : "success"}>{person.isActive ? <UserRoundX className="h-4 w-4" /> : <UserRoundCheck className="h-4 w-4" />}{person.isActive ? "Deactivate" : "Activate"}</Button></form></div></td></tr>)}</tbody></table></div> : <EmptyState title="No salesperson profiles" description="Create profiles only when individual accountability is required." />}
        </Card>
      </div>
    </>
  );
}
