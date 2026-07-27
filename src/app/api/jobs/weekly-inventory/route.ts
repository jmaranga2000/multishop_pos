import { NextResponse } from "next/server";
import { runWeeklyInventoryJob } from "@/services/jobs/weekly-inventory-job-service";

function authorized(request: Request) {
  return request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await runWeeklyInventoryJob();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Report generation failed" }, { status: 500 });
  }
}
