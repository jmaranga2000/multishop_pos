import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";
import { getQStashVerificationUrl } from "@/lib/qstash";
import { runDailyShopPerformanceSummary } from "@/services/jobs/weekly-inventory-job-service";

export const runtime = "nodejs";

async function handler() {
  try {
    return NextResponse.json(await runDailyShopPerformanceSummary());
  } catch (error) {
    console.error("QStash daily shop summary job failed:", error);
    return NextResponse.json({ error: "Daily shop summary failed." }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler, {
  url: getQStashVerificationUrl("/api/jobs/daily-shop-summary"),
});