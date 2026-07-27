import { Banknote, CircleDollarSign, LockKeyhole, UnlockKeyhole } from "lucide-react";
import { requireShop } from "@/lib/rbac";
import { openRegisterAction, closeRegisterAction } from "@/actions/shop/register-actions";
import { getShopRegisterData } from "@/services/shop/register-service";
import { formatMoney } from "@/lib/utils";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await requireShop();
  const { business, registers, salespeople, openSession, recentSessions } = await getShopRegisterData(user.shopId, user.businessId);

  return (
    <>
      <PageHeading title="Cash register" description="Open a register before selling and reconcile physical cash when the shift closes." />
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader><div><h2 className="font-extrabold">{openSession ? "Close active register" : "Open register"}</h2><p className="text-sm text-slate-500">{openSession ? `${openSession.register.name} opened ${openSession.openedAt.toLocaleString("en-KE")}` : "Only one register session can be open for this shop."}</p></div></CardHeader>
          <CardContent>
            {openSession ? (
              <form action={closeRegisterAction} className="space-y-3">
                <input type="hidden" name="sessionId" value={openSession.id} />
                <div className="rounded-xl bg-blue-50 p-4"><p className="text-xs font-semibold uppercase text-blue-700">Opening cash</p><p className="mt-1 text-2xl font-black text-blue-950">{formatMoney(openSession.openingCash.toString(), business.currency)}</p></div>
                <Input name="actualCash" type="number" min="0" step="0.01" placeholder="Actual cash counted" required />
                <textarea name="closingNote" placeholder="Closing note (optional)" className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm" />
                <Button variant="danger" className="w-full"><LockKeyhole className="h-4 w-4" />Close and reconcile</Button>
              </form>
            ) : registers.length ? (
              <form action={openRegisterAction} className="space-y-3">
                <select name="registerId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Select register</option>{registers.map((register) => <option key={register.id} value={register.id}>{register.name}</option>)}</select>
                <Input name="openingCash" type="number" min="0" step="0.01" placeholder="Opening cash" required />
                <select name="salespersonId" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">No salesperson PIN profile</option>{salespeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
                <Input name="pin" type="password" inputMode="numeric" placeholder="Salesperson PIN when selected" />
                <textarea name="openingNote" placeholder="Opening note (optional)" className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm" />
                <Button className="w-full"><UnlockKeyhole className="h-4 w-4" />Open register</Button>
              </form>
            ) : <EmptyState title="No active register" description="Ask the administrator to configure a register for this shop." />}
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader><div><h2 className="font-extrabold">Recent sessions</h2><p className="text-sm text-slate-500">Opening, closing and variance history for this shop.</p></div></CardHeader>
          {recentSessions.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Register</th><th>Operator</th><th>Opened</th><th>Opening</th><th>Expected</th><th>Actual</th><th>Variance</th><th>Status</th></tr></thead><tbody>{recentSessions.map((session) => <tr key={session.id}><td><div className="flex items-center gap-2"><Banknote className="h-4 w-4 text-slate-400" />{session.register.name}</div></td><td>{session.salesperson?.name ?? "Shop account"}</td><td>{session.openedAt.toLocaleString("en-KE")}</td><td>{formatMoney(session.openingCash.toString(), business.currency)}</td><td>{session.expectedCash ? formatMoney(session.expectedCash.toString(), business.currency) : "—"}</td><td>{session.actualCash ? formatMoney(session.actualCash.toString(), business.currency) : "—"}</td><td>{session.variance ? formatMoney(session.variance.toString(), business.currency) : "—"}</td><td><Badge tone={session.status === "OPEN" ? "warning" : "success"}>{session.status}</Badge></td></tr>)}</tbody></table></div> : <EmptyState icon={<CircleDollarSign className="h-7 w-7" />} title="No register history" description="Open the first shift to begin register tracking." />}
        </Card>
      </div>
    </>
  );
}
