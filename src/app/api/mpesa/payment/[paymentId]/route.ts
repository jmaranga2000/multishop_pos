import { NextResponse } from "next/server";
import { requireShop } from "@/lib/rbac";
import { AppError } from "@/lib/errors/app-error";
import { getMpesaPaymentStatus, presentMpesaPaymentStatus } from "@/services/shop/mpesa-service";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ paymentId: string }> }) {
  const user = await requireShop();
  try {
    const { paymentId } = await context.params;
    const payment = await getMpesaPaymentStatus(user.shopId, paymentId);
    return NextResponse.json({ ok: true, payment: presentMpesaPaymentStatus(payment) });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to check M-Pesa payment status." }, { status });
  }
}