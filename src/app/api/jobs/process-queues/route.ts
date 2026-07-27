import { NextResponse } from "next/server";
import { processNotificationQueues } from "@/services/jobs/queue-processing-service";

function authorized(request: Request) {
  return request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await processNotificationQueues();
  return NextResponse.json(result);
}
