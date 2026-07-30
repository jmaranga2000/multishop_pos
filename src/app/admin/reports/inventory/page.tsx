import Link from "next/link";
import { FileBarChart, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { formatMoney } from "@/lib/utils";
import { listInventoryReports } from "@/services/admin/report-service";
import { generateInventoryReportAction } from "@/actions/admin/report-actions";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function InventoryReportsPage() {
  const user = await requireAdmin();
  const { business, reports } = await listInventoryReports(user.businessId);
  return (
    <>
      <PageHeading
        title="Weekly inventory reports"
        description="Generated from MongoDB inventory movements; no dashboard figures are hardcoded."
        actions={<form action={generateInventoryReportAction}><Button><Plus className="h-4 w-4" />Generate report now</Button></form>}
      />
      <Card className="overflow-hidden">
        {reports.length ? (
          <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Reporting period</th><th>Units</th><th>Cost value</th><th>Low</th><th>Critical</th><th>Out</th><th>Status</th></tr></thead><tbody>{reports.map((report) => <tr key={report.id}><td><Link className="font-bold text-blue-700 hover:underline" href={`/admin/reports/inventory/${report.id}`}>{report.periodStart.toLocaleDateString("en-KE")} – {report.periodEnd.toLocaleDateString("en-KE")}</Link></td><td>{report.totalStockQuantity}</td><td>{formatMoney(report.totalCostValue.toString(), business.currency)}</td><td>{report.lowStockCount}</td><td>{report.criticalStockCount}</td><td>{report.outOfStockCount}</td><td><Badge tone={report.status === "COMPLETED" ? "success" : "warning"}>{report.status}</Badge></td></tr>)}</tbody></table></div>
        ) : <EmptyState icon={<FileBarChart className="h-7 w-7" />} title="No reports generated" description="Generate the first report now, then configure the weekly scheduler for Monday at 8:00 AM Africa/Nairobi." />}
      </Card>
    </>
  );
}
