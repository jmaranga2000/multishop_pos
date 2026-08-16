import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { requireAdmin } from "@/lib/rbac";
import { formatMoney } from "@/lib/utils";
import { getAdminEtimsReportingData } from "@/services/admin/etims-reporting-service";

export const dynamic = "force-dynamic";

function toneForStatus(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "ETIMS_SUCCESS") return "success";
  if (["ETIMS_PENDING", "ETIMS_SUBMITTING", "ETIMS_RETRY_REQUIRED"].includes(status)) return "warning";
  if (["ETIMS_FAILED", "ETIMS_REJECTED", "ETIMS_CANCELLED"].includes(status)) return "danger";
  return "neutral";
}

export default async function EtimsHistoryPage() {
  const user = await requireAdmin();
  const data = await getAdminEtimsReportingData(user.businessId);

  return (
    <>
      <PageHeading title="eTIMS / VAT history" description="Fiscal transaction records and VAT reporting. Only transactions confirmed by the configured certified provider are counted as fiscalized." />
      <div className="mb-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Card className="p-4"><p className="text-xs font-semibold uppercase text-slate-500">Fiscalized</p><p className="mt-1 text-2xl font-black text-emerald-700">{data.summary.fiscalizedCount}</p></Card>
        <Card className="p-4"><p className="text-xs font-semibold uppercase text-slate-500">Pending/retry</p><p className="mt-1 text-2xl font-black text-amber-700">{data.summary.pendingCount}</p></Card>
        <Card className="p-4"><p className="text-xs font-semibold uppercase text-slate-500">Failed/rejected</p><p className="mt-1 text-2xl font-black text-red-700">{data.summary.failedCount}</p></Card>
        <Card className="p-4"><p className="text-xs font-semibold uppercase text-slate-500">Taxable sales</p><p className="mt-1 font-black">{formatMoney(data.summary.taxableAmount.toString(), data.currency)}</p></Card>
        <Card className="p-4"><p className="text-xs font-semibold uppercase text-slate-500">VAT collected</p><p className="mt-1 font-black">{formatMoney(data.summary.vatAmount.toString(), data.currency)}</p></Card>
        <Card className="p-4"><p className="text-xs font-semibold uppercase text-slate-500">VAT gross sales</p><p className="mt-1 font-black">{formatMoney(data.summary.grossAmount.toString(), data.currency)}</p></Card>
      </div>
      <Card className="overflow-hidden">
        <CardHeader><h2 className="font-extrabold">eTIMS transaction ledger</h2></CardHeader>
        {data.rows.length ? <div className="overflow-x-auto"><table className="data-table w-full"><thead><tr><th>Created</th><th>Receipt</th><th>Shop</th><th>Status</th><th>Taxable</th><th>VAT</th><th>Gross</th><th>Official references</th><th>Error</th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.id}><td className="whitespace-nowrap text-sm">{row.createdAt ? new Date(row.createdAt).toLocaleString("en-KE") : "—"}</td><td className="font-mono text-xs font-bold">{row.receiptNumber}</td><td>{row.shopName}</td><td><Badge tone={toneForStatus(row.status)}>{row.status.replace("ETIMS_", "")}</Badge></td><td>{formatMoney(row.taxableAmount.toString(), data.currency)}</td><td>{formatMoney(row.vatAmount.toString(), data.currency)}</td><td className="font-semibold">{formatMoney(row.grossAmount.toString(), data.currency)}</td><td className="max-w-56 text-xs text-slate-600">{[row.officialInvoiceNumber && `Invoice: ${row.officialInvoiceNumber}`, row.fiscalDocumentNumber && `Document: ${row.fiscalDocumentNumber}`, row.controlCode && `Control: ${row.controlCode}`].filter(Boolean).join(" · ") || "Awaiting provider response"}</td><td className="max-w-64 text-xs text-red-700">{row.errorMessage ?? "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="No eTIMS transactions" description="Fiscal eTIMS transactions will appear here once a certified provider is configured and a sale is submitted." />}
      </Card>
    </>
  );
}