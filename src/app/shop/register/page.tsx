import { Banknote, CircleDollarSign, UnlockKeyhole, Wallet, Phone } from "lucide-react";
import { requireShop } from "@/lib/rbac";
import { openRegisterAction, getCountersForShopAction } from "@/actions/shop/register-actions";
import { getShopRegisterData } from "@/services/shop/register-service";
import { formatMoney } from "@/lib/utils";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FingerprintRegisterControls } from "@/components/shop/fingerprint-register-controls";
import { RegisterCloseForm } from "@/components/shop/register-close-form";
import { CounterRegisterSelect } from "@/components/shop/counter-register-select";
import { getCounterAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatSessionTimestamp(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isFinite(date.getTime()) ? date.toISOString().replace("T", " ").slice(0, 19) : "Unknown time";
}

export default async function RegisterPage() {
  const user = await requireShop();
  const counterAccess = await getCounterAccess(user);
  const { business, shop, counters, registers, salespeople, openSessions, recentSessions, paymentChannels, paymentWarnings } = await getShopRegisterData(user.shopId, user.businessId, counterAccess?.counterId);
  const terminalCounters = counters.filter((counter) => counter.id === counterAccess?.counterId);

  return (
    <>
      <PageHeading title="Register session" description="Open a register before selling and reconcile Cash, M-Pesa and other payment channels when the shift closes." />
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card className="md:flex md:h-[calc(100vh-13rem)] md:min-h-0 md:flex-col md:overflow-hidden">
          <CardHeader>
            <div>
              <h2 className="font-extrabold">{openSessions.length > 0 ? "Register sessions open" : "Open register session"}</h2>
              <p className="text-sm text-slate-500">
                {openSessions.length > 0 
                  ? `${openSessions.length} counter${openSessions.length === 1 ? "" : "s"} with active sessions` 
                  : "Open a register session for a counter and track Cash and M-Pesa in one place."}
              </p>
            </div>
          </CardHeader>
          <CardContent className="md:min-h-0 md:flex-1 md:overflow-y-auto">
            {openSessions.length > 0 ? (
              <div className="mb-6 space-y-4">
                {openSessions.map((session) => (
                  <RegisterCloseForm key={session.id} openSession={session} currency={business.currency} />
                ))}
              </div>
            ) : null}
            {openSessions.length === 0 && registers.length ? (
              <form action={openRegisterAction} className="space-y-4">
                <div className="rounded-2xl border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Shop</p>
                  <p className="mt-1 font-semibold">{shop.name}</p>
                </div>
                <div><CounterRegisterSelect counters={terminalCounters} /></div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Cashier</label>
                  <select id="register-salesperson-id" name="salespersonId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                    <option value="">Select cashier</option>
                    {salespeople.map((salesperson) => <option key={salesperson.id} value={salesperson.id}>{salesperson.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Cashier PIN (or fingerprint)</label>
                  <Input id="register-pin" name="pin" type="password" inputMode="numeric" autoComplete="one-time-code" placeholder="Enter cashier PIN" className="mt-0" maxLength={6} />
                  <p className="mt-1 text-xs text-slate-500">Required only if fingerprint is not used.</p>
                </div>
                <FingerprintRegisterControls />
                <div className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-semibold">Cash opening</p>
                  </div>
                  <Input name="openingCash" type="number" min="0" step="0.01" placeholder="Opening cash float" required className="mt-3" />
                </div>
                <div className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-semibold">M-Pesa opening</p>
                  </div>
                  <Input name="openingMpesaBalance" type="number" min="0" step="0.01" placeholder="Opening M-Pesa balance" required className="mt-3" />
                </div>
                <textarea name="openingNote" placeholder="Opening note (optional)" className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm" />
                <Button type="submit" className="w-full"><UnlockKeyhole className="h-4 w-4" />Open register session</Button>
              </form>
            ) : <EmptyState title="No active register" description="Ask the administrator to configure a register for this shop." />}
          </CardContent>
        </Card>
        <Card className="overflow-hidden md:flex md:h-[calc(100vh-13rem)] md:min-h-0 md:flex-col">
          <CardHeader><div><h2 className="font-extrabold">Recent sessions</h2><p className="text-sm text-slate-500">Opening, closing and reconciliation history for this shop.</p></div></CardHeader>
          {recentSessions.length ? <div className="min-h-0 flex-1 overflow-auto"><table className="data-table"><thead><tr><th>Counter</th><th>Register</th><th>Operator</th><th>Opened</th><th>Closed</th><th>Cash opening</th><th>M-Pesa opening</th><th>Expected cash</th><th>Variance</th><th>Status</th></tr></thead><tbody>{recentSessions.map((session) => <tr key={session.id}><td>{session.counterId ? counters.find(c => c.id === session.counterId)?.name || "Unknown" : "Default"}</td><td><div className="flex items-center gap-2"><Banknote className="h-4 w-4 text-slate-400" />{session.register.name}</div></td><td>{session.salesperson?.name ?? "Shop account"}</td><td>{formatSessionTimestamp(session.openedAt)}</td><td>{session.closedAt ? formatSessionTimestamp(session.closedAt) : "—"}</td><td>{formatMoney(session.openingCash.toString(), business.currency)}</td><td>{formatMoney((session.openingMpesaBalance ?? 0).toString(), business.currency)}</td><td>{formatMoney((session.expectedCash ?? 0).toString(), business.currency)}</td><td>{session.variance !== null && session.variance !== undefined ? formatMoney(session.variance.toString(), business.currency) : "—"}</td><td><Badge tone={session.status === "OPEN" ? "warning" : session.variance && session.variance !== 0 ? "danger" : "success"}>{session.status}</Badge></td></tr>)}</tbody></table></div> : <EmptyState icon={<CircleDollarSign className="h-7 w-7" />} title="No register history" description="Open the first shift to begin register tracking." />}
        </Card>
      </div>
    </>
  );
}
