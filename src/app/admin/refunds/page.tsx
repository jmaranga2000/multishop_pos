import { Check, RotateCcw, X } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { reviewRefundAction } from "@/actions/admin/refund-actions";
import { getAdminRefundPageData } from "@/services/admin/refund-service";
import { formatMoney } from "@/lib/utils";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function RefundsPage() {
  const user = await requireAdmin();
  const { requests, business } = await getAdminRefundPageData(user.businessId);
  return <><PageHeading title="Refund requests" description="Review shop requests without modifying or deleting the original sale." /><Card className="overflow-hidden"><CardHeader><h2 className="font-extrabold">Requests</h2></CardHeader>{requests.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Receipt</th><th>Shop</th><th>Amount</th><th>Reason</th><th>Status</th><th>Review</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><div className="flex items-center gap-2"><RotateCcw className="h-4 w-4 text-slate-400" /><span className="font-bold">{request.sale.receiptNumber}</span></div></td><td>{request.shop.name}</td><td>{formatMoney(request.sale.total.toString(), business.currency)}</td><td className="max-w-sm">{request.reason}</td><td><Badge tone={request.status === "COMPLETED" ? "success" : request.status === "REJECTED" ? "danger" : "warning"}>{request.status}</Badge></td><td>{request.status === "PENDING" ? <div className="space-y-2"><form action={reviewRefundAction} className="flex min-w-80 gap-2"><input type="hidden" name="refundRequestId" value={request.id} /><input type="hidden" name="decision" value="APPROVED" /><Input name="reviewNote" placeholder="Optional review note" /><Button size="sm" variant="success"><Check className="h-4 w-4" />Approve full refund</Button></form><form action={reviewRefundAction}><input type="hidden" name="refundRequestId" value={request.id} /><input type="hidden" name="decision" value="REJECTED" /><Button size="sm" variant="danger"><X className="h-4 w-4" />Reject</Button></form></div> : <span className="text-xs text-slate-500">{request.reviewNote ?? "Reviewed"}</span>}</td></tr>)}</tbody></table></div> : <EmptyState title="No refund requests" description="Requests submitted by shops will appear here." />}</Card></>;
}
