import Link from "next/link";
import { ArrowLeft, ChartNoAxesCombined, ReceiptText, RotateCcw, ShieldCheck, Store, WalletCards } from "lucide-react";
import { EmployeePerformanceVisualsClient } from "@/components/admin/employee-performance-visuals-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeading } from "@/components/ui/page-heading";
import { requireAdmin } from "@/lib/rbac";
import { formatMoney } from "@/lib/utils";
import { getEmployeePerformanceDetail } from "@/services/admin/employee-performance-service";

export const dynamic = "force-dynamic";

type DetailSearchParams = { shopId?: string; from?: string; to?: string };

function metricTone(attention: "NORMAL" | "ATTENTION" | "REVIEW_REQUIRED") {
  return attention === "NORMAL" ? "success" : attention === "ATTENTION" ? "warning" : "danger" as const;
}

function saleTone(status: string) {
  return status === "COMPLETED" ? "success" : status === "REFUNDED" ? "warning" : status === "VOIDED" ? "danger" : "neutral" as const;
}

export default async function EmployeePerformanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<DetailSearchParams>;
}) {
  const user = await requireAdmin();
  const { employeeId } = await params;
  const filters = await searchParams;
  const from = filters.from ? new Date(filters.from) : undefined;
  const to = filters.to ? new Date(filters.to) : undefined;
  const data = await getEmployeePerformanceDetail(user.businessId, employeeId, {
    shopId: filters.shopId,
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
  });
  const returnQuery = new URLSearchParams();
  if (filters.shopId) returnQuery.set("shopId", filters.shopId);
  if (filters.from) returnQuery.set("from", filters.from);
  if (filters.to) returnQuery.set("to", filters.to);
  const returnHref = `/admin/employee-performance${returnQuery.size ? `?${returnQuery}` : ""}`;
  const initials = data.employee.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "E";
  const dateRange = `${data.from.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })} – ${data.to.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={returnHref} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" />Back to employee performance</Link>
        <Badge tone={metricTone(data.metrics.attention)}>{data.metrics.attention.replaceAll("_", " ")}</Badge>
      </div>
      <PageHeading title={data.employee.name} description={`Employee performance detail · ${dateRange}`} />

      <Card>
        <CardContent className="flex flex-col gap-5 pt-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-lg font-extrabold text-blue-800">{initials}</div>
            <div>
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-extrabold">{data.employee.name}</h2><Badge tone={data.employee.isActive ? "success" : "neutral"}>{data.employee.isActive ? "Active" : "Inactive"}</Badge></div>
              <p className="mt-1 text-sm text-slate-600">Cashier code: <span className="font-semibold text-slate-900">{data.employee.code}</span></p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-500"><Store className="h-3.5 w-3.5" />{data.employee.shop?.name ?? "No shop assigned"}</p>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><p className="font-semibold text-slate-900">Review context</p><p>Figures are operational indicators for review, not disciplinary conclusions.</p></div>
        </CardContent>
      </Card>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<ChartNoAxesCombined className="h-5 w-5 text-blue-700" />} label="Net sales" value={formatMoney(data.metrics.netSales, data.business.currency)} detail={`${data.metrics.transactionCount} settled transactions`} />
        <MetricCard icon={<ReceiptText className="h-5 w-5 text-emerald-700" />} label="Average sale" value={formatMoney(data.metrics.averageTransaction, data.business.currency)} detail={`${data.metrics.completedSales} completed sales`} />
        <MetricCard icon={<WalletCards className="h-5 w-5 text-violet-700" />} label="Register variance" value={formatMoney(data.metrics.registerVariance, data.business.currency)} detail={`${data.metrics.registerSessions} register sessions`} emphasize={Math.abs(data.metrics.registerVariance) >= 300} />
        <MetricCard icon={<RotateCcw className="h-5 w-5 text-amber-700" />} label="Refunds & voids" value={`${data.metrics.refundCount} / ${data.metrics.voidCount}`} detail={`${formatMoney(data.metrics.refunds, data.business.currency)} refunded`} emphasize={data.metrics.refundCount > 0 || data.metrics.voidCount > 0} />
      </section>

      <Card className="mt-5">
        <CardHeader><div><h2 className="font-extrabold">Sales and payment performance</h2><p className="text-sm text-slate-500">Visual breakdown for the selected reporting period.</p></div></CardHeader>
        <CardContent><EmployeePerformanceVisualsClient currency={data.business.currency} dailySales={data.dailySales} payments={data.payments} /></CardContent>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.25fr]">
        <Card className="overflow-hidden">
          <CardHeader><div><h2 className="font-extrabold">Top products sold</h2><p className="text-sm text-slate-500">Products contributing most to recorded sales.</p></div></CardHeader>
          <div className="overflow-x-auto"><table className="data-table w-full"><thead><tr><th>Product</th><th>Quantity</th><th>Sales</th></tr></thead><tbody>{data.topProducts.length ? data.topProducts.map((product) => <tr key={product.productName}><td className="font-medium">{product.productName}</td><td>{product.quantity.toLocaleString("en-KE", { maximumFractionDigits: 2 })}</td><td>{formatMoney(product.sales, data.business.currency)}</td></tr>) : <tr><td colSpan={3} className="py-8 text-center text-slate-500">No settled product sales in this period.</td></tr>}</tbody></table></div>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader><div><h2 className="font-extrabold">Recent sales</h2><p className="text-sm text-slate-500">Latest cashier-attributed transactions, including refunds and voids.</p></div></CardHeader>
          <div className="overflow-x-auto"><table className="data-table w-full"><thead><tr><th>Receipt</th><th>Customer</th><th>When</th><th>Total</th><th>Status</th></tr></thead><tbody>{data.recentSales.length ? data.recentSales.map((sale) => <tr key={sale.id}><td><p className="font-semibold">{sale.receiptNumber}</p><p className="text-xs text-slate-500">{sale.shopName}</p></td><td>{sale.customerName}</td><td className="text-xs">{sale.occurredAt.toLocaleString("en-KE")}</td><td>{formatMoney(sale.total, data.business.currency)}</td><td><Badge tone={saleTone(sale.status)}>{sale.status}</Badge></td></tr>) : <tr><td colSpan={5} className="py-8 text-center text-slate-500">No sale activity in this period.</td></tr>}</tbody></table></div>
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader><div><h2 className="font-extrabold">Register sessions</h2><p className="text-sm text-slate-500">Recent register activity assigned to this cashier.</p></div></CardHeader>
        <div className="overflow-x-auto"><table className="data-table w-full"><thead><tr><th>Register</th><th>Opened</th><th>Closed</th><th>Status</th><th>Combined variance</th></tr></thead><tbody>{data.recentSessions.length ? data.recentSessions.map((session) => <tr key={session.id}><td className="font-medium">{session.registerName}</td><td>{session.openedAt.toLocaleString("en-KE")}</td><td>{session.closedAt?.toLocaleString("en-KE") ?? "Open"}</td><td><Badge tone={session.status === "CLOSED" ? "neutral" : "success"}>{session.status}</Badge></td><td className={Math.abs(session.variance) >= 300 ? "font-semibold text-amber-800" : ""}>{formatMoney(session.variance, data.business.currency)}</td></tr>) : <tr><td colSpan={5} className="py-8 text-center text-slate-500">No register sessions in this period.</td></tr>}</tbody></table></div>
      </Card>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4" />All values respect the active date and shop filters.</div>
    </>
  );
}

function MetricCard({ icon, label, value, detail, emphasize = false }: { icon: React.ReactNode; label: string; value: string; detail: string; emphasize?: boolean }) {
  return <Card><CardContent className="flex items-start gap-3 pt-4"><div className="rounded-xl bg-slate-100 p-2">{icon}</div><div><p className="text-sm text-slate-500">{label}</p><p className={emphasize ? "mt-1 text-xl font-extrabold text-amber-800" : "mt-1 text-xl font-extrabold"}>{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div></CardContent></Card>;
}