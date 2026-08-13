import { db } from "@/lib/db";
import { buildShopPerformanceHtml, queueNotification } from "@/lib/notifications/service";
import { generateInventoryReport, previousWeekRange } from "@/lib/reports/weekly-inventory";
import { buildDailySnapshotDataForShop, renderDailySnapshotPdfBuffer } from "@/lib/reports/daily-snapshot";

const NAIROBI_UTC_OFFSET_MS = 3 * 60 * 60 * 1_000;

function getNairobiDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

export async function runWeeklyInventoryJob() {
  const log = await db.scheduledJobLog.create({ data: { jobType: "WEEKLY_INVENTORY", status: "RUNNING" } });
  const range = previousWeekRange();
  try {
    const businesses = await db.business.findMany({ select: { id: true } });
    for (const business of businesses) {
      await generateInventoryReport(business.id, range.periodStart, range.periodEnd);
    }
    await db.scheduledJobLog.update({
      where: { id: log.id },
      data: { status: "COMPLETED", recordsProcessed: businesses.length, completedAt: new Date() },
    });
    return { generated: businesses.length, ...range };
  } catch (error) {
    await db.scheduledJobLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        recordsFailed: 1,
        errorSummary: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function runDailyShopPerformanceSummary() {
  const log = await db.scheduledJobLog.create({ data: { jobType: "DAILY_SHOP_SUMMARY", status: "RUNNING" } });
  const nowInNairobi = new Date();
  const parts = getNairobiDateParts(nowInNairobi);
  const todayStart = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0) - NAIROBI_UTC_OFFSET_MS);
  const todayEnd = nowInNairobi;
  try {
    const businesses = await db.business.findMany({ include: { shops: true } });
    let processed = 0;
    for (const business of businesses) {
      const admin = await db.user.findFirst({ where: { businessId: business.id, role: "ADMIN", status: "ACTIVE" } });
      if (!admin) continue;
      const sales = await db.sale.findMany({
        where: {
          shop: { businessId: business.id },
          occurredAt: { gte: todayStart, lte: todayEnd },
          status: "COMPLETED",
        },
        include: { shop: true },
      });
      const shopRows = (business.shops ?? []).map((shop: { id: string; name: string }) => {
        const shopSales = sales.filter((sale) => sale.shopId === shop.id);
        const charge = shopSales.reduce((sum, sale) => sum + Number(sale.total), 0);
        return { label: shop.name, value: `KSh ${charge.toLocaleString("en-KE")}`, description: `${shopSales.length} transactions`, tone: charge > 0 ? "green" as const : "slate" as const };
      });
      const preferences = await db.notificationPreference.findUnique({ where: { businessId: business.id } });
      const inAppEnabled = preferences?.weeklyReportInApp ?? true;
      const pushEnabled = preferences?.weeklyReportPush ?? true;
      const emailEnabled = preferences?.weeklyReportEmail ?? true;
      const html = buildShopPerformanceHtml(shopRows.length ? shopRows : [{ label: "No active shops", value: "KSh 0", description: "No sales captured today", tone: "slate" as const }]);
        const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
        // Build per-shop PDF snapshots and queue separate notifications per shop (attached in email)
        for (const shop of business.shops ?? []) {
          try {
            const snapshotData = await buildDailySnapshotDataForShop(business.id, shop.id, new Date());
            const buffer = await renderDailySnapshotPdfBuffer(snapshotData);
            const filename = `daily-snapshot-${shop.name.replace(/[^a-z0-9_-]/gi, "_")}-${new Date().toISOString().slice(0, 10)}.pdf`;
            const attachments = [{ filename, contentType: "application/pdf", content: Buffer.from(buffer).toString("base64") }];

            await queueNotification({
              businessId: business.id,
              userId: admin.id,
              shopId: shop.id,
              type: "WEEKLY_REPORT",
              title: `Daily snapshot — ${shop.name}`,
              message: `${business.name}: daily snapshot for ${shop.name}.`,
              actionUrl: "/admin/dashboard",
              inApp: inAppEnabled,
              push: pushEnabled,
              email: emailEnabled && (admin.email || process.env.ADMIN_EMAIL) ? { to: admin.email || process.env.ADMIN_EMAIL!, subject: `Daily snapshot — ${shop.name}`, html, attachments } : undefined,
            });
          } catch (err) {
            console.error(`Failed to build/attach daily snapshot for shop ${shop.id}:`, err);
          }
        }
      processed += 1;
    }
    await db.scheduledJobLog.update({
      where: { id: log.id },
      data: { status: "COMPLETED", recordsProcessed: processed, completedAt: new Date() },
    });
    return { processed, at: nowInNairobi.toISOString() };
  } catch (error) {
    await db.scheduledJobLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        recordsFailed: 1,
        errorSummary: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}