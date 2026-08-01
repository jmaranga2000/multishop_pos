import { NextResponse } from "next/server";
import { handleMpesaCallback } from "@/services/shop/mpesa-service";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await handleMpesaCallback(payload as Record<string, unknown>);
    return NextResponse.json({ ok: true, duplicate: result.duplicate, eventId: result.eventId });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
