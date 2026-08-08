import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";
import { getQStashVerificationUrl } from "@/lib/qstash";
import { processNotificationQueues } from "@/services/jobs/queue-processing-service";

export const runtime = "nodejs";

async function handler() {
  try {
    return NextResponse.json(await processNotificationQueues());
  } catch (error) {
    console.error("QStash notification queue processing failed:", error);
    return NextResponse.json({ error: "Notification queue processing failed." }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler, {
  url: getQStashVerificationUrl("/api/jobs/process-queues"),
});