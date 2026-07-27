import { Plus, UserRoundCheck, UserRoundX } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { createSalespersonAction, toggleSalespersonAction } from "@/actions/admin/salesperson-actions";
import { getSalespersonManagementData } from "@/services/admin/salesperson-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function SalespeoplePage() {
  const user = await requireAdmin();
  const { shops, salespeople } = await getSalespersonManagementData(user.businessId);
  return (
    <>
      <PageHeading title="Salespeople" description="Optional PIN profiles identify the person operating a shared shop login." />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <CardHeader><h2 className="font-extrabold">Salesperson profiles</h2></CardHeader>
          {salespeople.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Name</th><th>Shop</th><th>Code</th><th>Sales</th><th>Sessions</th><th>Status</th><th>Action</th></tr></thead><tbody>{salespeople.map((person) => <tr key={person.id}><td className="font-bold">{person.name}</td><td>{person.shop.name}</td><td className="font-mono text-xs">{person.code}</td><td>{person._count.sales}</td><td>{person._count.sessions}</td><td><Badge tone={person.isActive ? "success" : "danger"}>{person.isActive ? "Active" : "Inactive"}</Badge></td><td><form action={toggleSalespersonAction}><input type="hidden" name="salespersonId" value={person.id} /><input type="hidden" name="isActive" value={String(!person.isActive)} /><Button size="sm" variant={person.isActive ? "danger" : "success"}>{person.isActive ? <UserRoundX className="h-4 w-4" /> : <UserRoundCheck className="h-4 w-4" />}{person.isActive ? "Deactivate" : "Activate"}</Button></form></td></tr>)}</tbody></table></div> : <EmptyState title="No salesperson profiles" description="Create profiles only when individual accountability is required." />}
        </Card>
        <Card>
          <CardHeader><div><h2 className="font-extrabold">Create salesperson</h2><p className="text-sm text-slate-500">The PIN is hashed before storage.</p></div></CardHeader>
          <CardContent><form action={createSalespersonAction} className="space-y-3"><select name="shopId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Select shop</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select><Input name="name" placeholder="Full name" required /><Input name="code" placeholder="Short code, e.g. MARY01" required /><Input name="pin" type="password" inputMode="numeric" pattern="[0-9]{4,6}" placeholder="4–6 digit PIN" required /><Button className="w-full"><Plus className="h-4 w-4" />Create profile</Button></form></CardContent>
        </Card>
      </div>
    </>
  );
}
