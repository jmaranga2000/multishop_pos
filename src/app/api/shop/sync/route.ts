import { NextResponse } from "next/server";
import { requireShop } from "@/lib/rbac";
import { AppError } from "@/lib/errors/app-error";
import { synchronizeOfflineSales } from "@/services/shop/offline-sync-service";
import { offlineSyncPayloadSchema } from "@/validators/shop/offline-sync-validator";

export async function POST(request: Request) {
  const user = await requireShop();
  const parsed = offlineSyncPayloadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid synchronization payload", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await synchronizeOfflineSales(user, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Synchronization failed" }, { status: 500 });
  }
}
