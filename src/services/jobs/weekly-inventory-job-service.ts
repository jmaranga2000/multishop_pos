import { db } from "@/lib/db";
import { generateInventoryReport, previousWeekRange } from "@/lib/reports/weekly-inventory";

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
