import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileSpreadsheet } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { formatMoney } from "@/lib/utils";
import { getInventoryReportDetail } from "@/services/admin/report-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ReportDetail({ params }: { params: Promise<{ reportId: string }> }) {
  const user = await requireAdmin();
  const { reportId } = await params;
  const report = await getInventoryReportDetail(user.businessId, reportId);
  if (!report) notFound();

  return (
    <>
      <PageHeading
        title="Weekly inventory report"
        description={`${report.periodStart.toLocaleDateString("en-KE")} – ${report.periodEnd.toLocaleDateString("en-KE")}`}
        actions={<div className="flex gap-2"><Link href={`/api/reports/inventory/${report.id}/excel`}><Button variant="secondary"><FileSpreadsheet className="h-4 w-4" />Excel</Button></Link><Link href={`/api/reports/inventory/${report.id}/pdf`}><Button><Download className="h-4 w-4" />PDF</Button></Link></div>}
      />
      <div className="mb-4">
        <Link href="/admin/reports/inventory" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Back to list
        </Link>
      </div>
      <div className="kpi-grid">
        <Card className="p-5"><p className="text-sm text-slate-500">Units remaining</p><p className="mt-2 text-2xl font-black">{report.totalStockQuantity}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Cost value</p><p className="mt-2 text-2xl font-black">{formatMoney(report.totalCostValue.toString(), report.business.currency)}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Low / critical</p><p className="mt-2 text-2xl font-black">{report.lowStockCount} / {report.criticalStockCount}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Out of stock</p><p className="mt-2 text-2xl font-black">{report.outOfStockCount}</p></Card>
      </div>
      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Shop</th>
                <th>Opening</th>
                <th>Added</th>
                <th>Sold</th>
                <th>Closing</th>
                <th>Daily avg.</th>
                <th>Days left</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {report.items.map((item: typeof report.items[number]) => {
                const productName = item.product?.name ?? "Unknown product";
                const productSku = item.product?.sku ?? "";
                return (
                  <tr key={item.id}>
                    <td>
                      <p className="font-bold">{productName}</p>
                      {productSku ? <p className="text-xs text-slate-500">{productSku}</p> : null}
                    </td>
                    <td>{item.shop.name}</td>
                    <td>{item.openingQuantity}</td>
                    <td>{item.quantityAdded}</td>
                    <td>{item.quantitySold}</td>
                    <td className="font-black">{item.closingQuantity}</td>
                    <td>{Number(item.averageDailySales).toFixed(1)}</td>
                    <td>{item.estimatedDaysRemaining === null ? "No recent sales" : Number(item.estimatedDaysRemaining).toFixed(1)}</td>
                    <td>
                      <Badge tone={item.stockStatus === "IN_STOCK" ? "success" : item.stockStatus === "LOW_STOCK" ? "warning" : "danger"}>
                        {item.stockStatus.replaceAll("_", " ")}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
