import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getBusinessSalesInRange } from "@/services/admin/sales-service";
import { SalesReportPdf } from "@/lib/reports/sales-pdf";
import { formatMoney } from "@/lib/utils";

const periodRanges: Record<string, (now: Date) => { start: Date; end: Date; name: string }> = {
  today: (now) => ({ start: new Date(now.setHours(0, 0, 0, 0)), end: new Date(now.setHours(23, 59, 59, 999)), name: "Today" }),
  week: (now) => {
    const end = new Date(now);
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end, name: "This week" };
  },
  month: (now) => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end, name: now.toLocaleString("en-KE", { month: "long", year: "numeric" }) };
  },
  quarter: (now) => {
    const quarter = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), quarter * 3, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999);
    return { start, end, name: `Q${quarter + 1} ${now.getFullYear()}` };
  },
};

export async function GET(_request: Request, { params }: { params: Promise<{ period: string }> }) {
  const user = await requireAdmin();
  const { period } = await params;
  const rangeProvider = periodRanges[period];
  if (!rangeProvider) return NextResponse.json({ error: "Unsupported period" }, { status: 400 });
  const now = new Date();
  const business = await db.business.findUniqueOrThrow({ where: { id: user.businessId } });
  const range = rangeProvider(new Date());
  const sales = await getBusinessSalesInRange(user.businessId, range.start, range.end);
  const report = {
    businessName: business.name,
    period: `${range.name} ${range.start.toLocaleDateString("en-KE")} – ${range.end.toLocaleDateString("en-KE")}`,
    totalSales: sales.length,
    totalRevenue: formatMoney(sales.reduce((sum, sale) => sum + Number(sale.total), 0).toString(), business.currency),
    items: sales.map((sale) => ({
      receipt: sale.receiptNumber,
      shop: sale.shop.name,
      date: sale.occurredAt.toLocaleString("en-KE"),
      items: sale._count.items,
      payment: sale.payments.map((payment: { method: string }) => payment.method).join(", "),
      total: formatMoney(sale.total.toString(), business.currency),
    })),
  };
  const buffer = await renderToBuffer(createElement(SalesReportPdf, { report }) as Parameters<typeof renderToBuffer>[0]);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sales-${period}-${range.start.toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
