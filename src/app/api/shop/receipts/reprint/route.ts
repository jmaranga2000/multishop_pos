import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireShop } from "@/lib/rbac";
import { writeAuditLog } from "@/services/shared/audit-service";

export async function POST(request: Request) {
  try {
    const user = await requireShop();
    const payload = await request.json();
    const receiptNumber = String(payload?.receiptNumber ?? "").trim();
    if (!receiptNumber) {
      return NextResponse.json({ ok: false, error: "Receipt number is required." }, { status: 400 });
    }

    await writeAuditLog(db, {
      userId: user.id,
      shopId: user.shopId,
      action: "REPRINT_RECEIPT",
      entityType: "SALE",
      entityId: receiptNumber,
      description: `Reprinted receipt ${receiptNumber}.`,
      metadata: { receiptNumber },
    });

    return NextResponse.json({ ok: true, receiptNumber });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
