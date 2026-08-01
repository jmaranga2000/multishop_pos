import { NextResponse } from "next/server";
import { startMpesaPayment } from "@/services/shop/mpesa-service";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await startMpesaPayment(payload as {
      shopId: string;
      saleId: string;
      cashierId?: string | null;
      shiftId?: string | null;
      customerPhone?: string | null;
      mode: "STK_PUSH" | "PAY_TO_TILL";
      expectedAmountMinor: number;
      tillNumber?: string | null;
      clientReference?: string | null;
      idempotencyKey?: string | null;
    });
    return NextResponse.json({ ok: true, payment: result.payment, expectedAmount: result.expectedAmount, normalizedPhone: result.normalizedPhone, internalReference: result.internalReference });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
