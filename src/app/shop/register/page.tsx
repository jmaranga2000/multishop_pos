import { Banknote, CircleDollarSign, LockKeyhole, UnlockKeyhole, AlertTriangle, Smartphone, Wallet, Phone } from "lucide-react";
import { requireShop } from "@/lib/rbac";
import { openRegisterAction, closeRegisterAction } from "@/actions/shop/register-actions";
import { getShopRegisterData } from "@/services/shop/register-service";
import { formatMoney, formatVariance } from "@/lib/utils";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

function formatSessionTimestamp(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isFinite(date.getTime()) ? date.toISOString().replace("T", " ").slice(0, 19) : "Unknown time";
}

export default async function RegisterPage() {
  const user = await requireShop();
  const { business, shop, registers, salespeople, openSession, recentSessions, paymentChannels, paymentWarnings } = await getShopRegisterData(user.shopId, user.businessId);

  return (
    <>
      <PageHeading title="Register session" description="Open a register before selling and reconcile Cash, M-Pesa and other payment channels when the shift closes." />
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">{openSession ? "Register session open" : "Open register session"}</h2>
              <p className="text-sm text-slate-500">{openSession ? `${openSession.register.name} opened ${formatSessionTimestamp(openSession.openedAt)}` : "Open one shared session for the shop and track Cash and M-Pesa in one place."}</p>
            </div>
          </CardHeader>
          <CardContent>
            {openSession ? (
              <form action={closeRegisterAction} className="space-y-4">
                <input type="hidden" name="sessionId" value={openSession.id} />
                <div className="rounded-2xl bg-blue-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-blue-700">Session status</p>
                      <p className="mt-1 text-xl font-black text-blue-950">{openSession.register.name}</p>
                      <p className="mt-1 text-sm text-blue-800">Opened {formatSessionTimestamp(openSession.openedAt)}</p>
                    </div>
                    <Badge tone="info">Live shift</Badge>
                  </div>
                  <p className="mt-2 text-xs font-medium text-blue-900">Expected balances are auto-calculated from verified sales and confirmed M-Pesa payments. The cashier only enters the counted balances at close.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase text-slate-500">Opening cash</p>
                    <p className="mt-1 font-semibold">{formatMoney((openSession.openingCash ?? 0).toString(), business.currency)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase text-slate-500">Cash sales</p>
                    <p className="mt-1 font-semibold">{formatMoney((openSession.cashSalesTotal ?? 0).toString(), business.currency)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase text-slate-500">Expected cash</p>
                    <p className="mt-1 font-semibold text-slate-900">{formatMoney((openSession.expectedCash ?? 0).toString(), business.currency)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase text-slate-500">Opening M-Pesa</p>
                    <p className="mt-1 font-semibold">{formatMoney((openSession.openingMpesaBalance ?? 0).toString(), business.currency)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase text-slate-500">M-Pesa sales</p>
                    <p className="mt-1 font-semibold">{formatMoney((openSession.mpesaSalesTotal ?? 0).toString(), business.currency)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase text-slate-500">Expected M-Pesa</p>
                    <p className="mt-1 font-semibold text-slate-900">{formatMoney((openSession.expectedMpesa ?? 0).toString(), business.currency)}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900">Cashier closeout inputs</p>
                    <Badge tone={(openSession.unresolvedPayments ?? 0) > 0 ? "warning" : "success"}>{(openSession.unresolvedPayments ?? 0) > 0 ? `${openSession.unresolvedPayments} unresolved` : "Clean reconciliation"}</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Actual cash counted</label>
                      <Input name="actualCash" type="number" min="0" step="0.01" placeholder="Physical cash counted" required />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Actual M-Pesa balance</label>
                      <Input name="actualMpesaBalance" type="number" min="0" step="0.01" placeholder="Actual M-Pesa balance" />
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-3">
                    <p className="text-xs uppercase text-slate-500">Derived cash variance</p>
                    <p className="mt-1 font-semibold text-slate-900">{formatVariance(Number(openSession.variance ?? 0), business.currency)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-3">
                    <p className="text-xs uppercase text-slate-500">M-Pesa status</p>
                    <p className="mt-1 font-semibold text-slate-700">{(openSession.unresolvedPayments ?? 0) > 0 ? `${openSession.unresolvedPayments} unresolved payment(s)` : "All confirmed M-Pesa payments are accounted for"}</p>
                  </div>
                </div>
                <textarea name="closingNote" placeholder="Closing note (optional)" className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm" />
                <textarea name="varianceReason" placeholder="Variance explanation required when counts differ" className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm" />
                <textarea name="unresolvedClosureReason" placeholder="Unresolved M-Pesa reason (required if any payment remains unresolved)" className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm" />
                <Button type="submit" variant="danger" className="w-full"><LockKeyhole className="h-4 w-4" />Close and reconcile</Button>
              </form>
            ) : registers.length ? (
              <form action={openRegisterAction} className="space-y-4">
                <div className="rounded-2xl border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Shop</p>
                  <p className="mt-1 font-semibold">{shop.name}</p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Register</label>
                  <select name="registerId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                    <option value="">Select register</option>
                    {registers.map((register) => <option key={register.id} value={register.id}>{register.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Cashier</label>
                  <select name="salespersonId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                    <option value="">Select cashier</option>
                    {salespeople.map((salesperson) => <option key={salesperson.id} value={salesperson.id}>{salesperson.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Cashier PIN</label>
                  <Input name="pin" type="password" inputMode="numeric" autoComplete="one-time-code" placeholder="Enter cashier PIN" required className="mt-0" maxLength={6} />
                </div>
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
        <Card className="overflow-hidden">
          <CardHeader><div><h2 className="font-extrabold">Recent sessions</h2><p className="text-sm text-slate-500">Opening, closing and reconciliation history for this shop.</p></div></CardHeader>
          {recentSessions.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Register</th><th>Operator</th><th>Opened</th><th>Cash opening</th><th>M-Pesa opening</th><th>Expected cash</th><th>Variance</th><th>Status</th></tr></thead><tbody>{recentSessions.map((session) => <tr key={session.id}><td><div className="flex items-center gap-2"><Banknote className="h-4 w-4 text-slate-400" />{session.register.name}</div></td><td>{session.salesperson?.name ?? "Shop account"}</td><td>{formatSessionTimestamp(session.openedAt)}</td><td>{formatMoney(session.openingCash.toString(), business.currency)}</td><td>{formatMoney((session.openingMpesaBalance ?? 0).toString(), business.currency)}</td><td>{formatMoney((session.expectedCash ?? 0).toString(), business.currency)}</td><td>{session.variance !== null && session.variance !== undefined ? formatMoney(session.variance.toString(), business.currency) : "—"}</td><td><Badge tone={session.status === "OPEN" ? "warning" : session.variance && session.variance !== 0 ? "danger" : "success"}>{session.status}</Badge></td></tr>)}</tbody></table></div> : <EmptyState icon={<CircleDollarSign className="h-7 w-7" />} title="No register history" description="Open the first shift to begin register tracking." />}
        </Card>
      </div>
    </>
  );
}
