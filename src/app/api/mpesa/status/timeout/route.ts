import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors/app-error";
import { assertValidMpesaCallback } from "@/lib/mpesa-env";
import { handleMpesaCallback } from "@/services/shop/mpesa-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertValidMpesaCallback(request);
    await handleMpesaCallback(await request.json() as Record<string, unknown>);
    return NextResponse.json({ ResultCode: "0", ResultDesc: "Accepted" });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 400;
    return NextResponse.json({ ResultCode: "1", ResultDesc: error instanceof Error ? error.message : "Invalid M-Pesa timeout callback." }, { status });
  }
}