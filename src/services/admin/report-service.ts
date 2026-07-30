import { db } from "@/lib/db";
import { generateInventoryReport, previousWeekRange } from "@/lib/reports/weekly-inventory";

export async function listInventoryReports(businessId: string) {
  const [business, reports] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.inventoryReport.findMany({ where: { businessId }, orderBy: { periodEnd: "desc" } }),
  ]);
  return { business, reports };
}

export async function getInventoryReportDetail(businessId: string, reportId: string) {
  return db.inventoryReport.findFirst({
    where: { id: reportId, businessId },
    include: {
      business: true,
      items: { include: { shop: true, product: true }, orderBy: [{ stockStatus: "asc" }, { shop: { name: "asc" } }] },
    },
  });
}

export async function generateInventoryReportNow(businessId: string) {
  const { periodStart, periodEnd } = previousWeekRange();
  return generateInventoryReport(businessId, periodStart, periodEnd);
}
