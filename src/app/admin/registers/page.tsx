import { Banknote, Clock3 } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { getAdminRegisterPageData } from "@/services/admin/register-service";
import { formatMoney } from "@/lib/utils";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function RegistersPage() {
  const user = await requireAdmin();
  const { sessions, business } = await getAdminRegisterPageData(user.businessId);
  return <><PageHeading title="Register reconciliation" description="Monitor open sessions, closing cash and cashier variances across all shops." /><Card className="overflow-hidden"><CardHeader><h2 className="font-extrabold">Register sessions</h2></CardHeader>{sessions.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Shop / register</th><th>Salesperson</th><th>Opened</th><th>Opening cash</th><th>Expected</th><th>Actual</th><th>Variance</th><th>Status</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td><div className="flex items-center gap-2"><Banknote className="h-4 w-4 text-slate-400" /><div><p className="font-bold">{session.shop.name}</p><p className="text-xs text-slate-500">{session.register.name}</p></div></div></td><td>{session.salesperson?.name ?? "Shop account"}</td><td><div className="flex items-center gap-1 text-xs"><Clock3 className="h-3.5 w-3.5" />{session.openedAt.toLocaleString("en-KE")}</div></td><td>{formatMoney(session.openingCash.toString(), business.currency)}</td><td>{session.expectedCash ? formatMoney(session.expectedCash.toString(), business.currency) : "—"}</td><td>{session.actualCash ? formatMoney(session.actualCash.toString(), business.currency) : "—"}</td><td className={Number(session.variance ?? 0) === 0 ? "text-slate-600" : "font-bold text-red-600"}>{session.variance ? formatMoney(session.variance.toString(), business.currency) : "—"}</td><td><Badge tone={session.status === "OPEN" ? "warning" : "success"}>{session.status}</Badge></td></tr>)}</tbody></table></div> : <EmptyState title="No register sessions" description="Register sessions will appear after a shop opens a counter." />}</Card></>;
}
