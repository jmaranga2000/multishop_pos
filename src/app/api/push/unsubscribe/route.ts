import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/rbac";
import { disablePushSubscription } from "@/services/push/subscription-service";

const schema = z.object({ endpoint: z.string().url() });

export async function POST(request: Request) {
  const user = await requireAdmin();
  const { endpoint } = schema.parse(await request.json());
  await disablePushSubscription(user.id, endpoint);
  return NextResponse.json({ ok: true });
}
