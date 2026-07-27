import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/rbac";
import { savePushSubscription } from "@/services/push/subscription-service";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  deviceName: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await requireAdmin();
  const data = schema.parse(await request.json());
  await savePushSubscription({
    userId: user.id,
    endpoint: data.endpoint,
    p256dh: data.keys.p256dh,
    auth: data.keys.auth,
    deviceName: data.deviceName,
    userAgent: request.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: true });
}
