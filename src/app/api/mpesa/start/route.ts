import { NextResponse } from "next/server";
import { requireShop } from "@/lib/rbac";
import { AppError } from "@/lib/errors/app-error";
import { startMpesaPayment } from "@/services/shop/mpesa-service";
import { startMpesaPaymentSchema } from "@/validators/shop/mpesa-validator";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireShop();
  const parsed = startMpesaPaymentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid M-Pesa payment request.", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await startMpesaPayment({
      ...parsed.data,
      shopId: user.shopId,
      cashierId: user.id,
    });
    return NextResponse.json({
      ok: true,
      payment: {
        id: result.payment.id,
        mode: result.payment.mode,
        status: result.payment.status,
        expectedAmountMinor: result.payment.expectedAmountMinor,
        internalReference: result.payment.internalReference,
        expiresAt: result.payment.expiryAt,
      },
      expectedAmount: result.expectedAmount,
      normalizedPhone: result.normalizedPhone,
      internalReference: result.internalReference,
      duplicate: result.duplicate,
    });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to start M-Pesa payment." }, { status });
  }
}