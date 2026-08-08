import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";
import { getQStashVerificationUrl } from "@/lib/qstash";
import { runWeeklyInventoryJob } from "@/services/jobs/weekly-inventory-job-service";

export const runtime = "nodejs";

async function handler() {
  try {
    return NextResponse.json(await runWeeklyInventoryJob());
  } catch (error) {
    console.error("QStash weekly inventory job failed:", error);
    return NextResponse.json({ error: "Report generation failed." }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler, {
  url: getQStashVerificationUrl("/api/jobs/weekly-inventory"),
});