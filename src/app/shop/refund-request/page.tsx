import { RotateCcw } from "lucide-react";
import { requireShop } from "@/lib/rbac";
import { createRefundRequestAction } from "@/actions/shop/refund-actions";
import { getShopRefundPageData } from "@/services/shop/refund-service";
import { formatMoney } from "@/lib/utils";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function RefundRequestPage() {
  const user = await requireShop();
  const { requests, business } = await getShopRefundPageData(user.shopId, user.businessId);
  return <><PageHeading title="Refund requests" description="Submit the original receipt to request administrator approval." /><div className="grid gap-5 xl:grid-cols-[1fr_380px]"><Card className="overflow-hidden"><CardHeader><h2 className="font-extrabold">Request history</h2></CardHeader>{requests.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Receipt</th><th>Sale amount</th><th>Requested</th><th>Reason</th><th>Status</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td className="font-bold">{request.sale.receiptNumber}</td><td>{formatMoney(request.sale.total.toString(), business.currency)}</td><td>{request.requestedAt.toLocaleString("en-KE")}</td><td>{request.reason}</td><td><Badge tone={request.status === "COMPLETED" ? "success" : request.status === "REJECTED" ? "danger" : "warning"}>{request.status}</Badge></td></tr>)}</tbody></table></div> : <EmptyState title="No refund requests" description="Requests submitted from this shop will appear here." />}</Card><Card><CardHeader><div><h2 className="font-extrabold">Request refund</h2><p className="text-sm text-slate-500">The original sale remains immutable.</p></div></CardHeader><CardContent><form action={createRefundRequestAction} className="space-y-3"><Input name="receiptNumber" placeholder="Original receipt number" required /><textarea name="reason" placeholder="Explain why the refund is required" className="min-h-32 w-full rounded-xl border border-slate-200 p-3 text-sm" required /><Button className="w-full"><RotateCcw className="h-4 w-4" />Submit request</Button></form></CardContent></Card></div></>;
}
