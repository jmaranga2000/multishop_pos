import { NextResponse } from "next/server";
import { requireShop } from "@/lib/rbac";
import { AppError } from "@/lib/errors/app-error";
import { getRecentMpesaConfirmationCandidates } from "@/services/shop/mpesa-service";

export async function GET(request: Request) {
  const user = await requireShop();
  try {
    const { searchParams } = new URL(request.url);
    const requestedShopId = searchParams.get("shopId");
    const expectedAmountMinor = Number(searchParams.get("expectedAmountMinor") ?? "0");
    if (requestedShopId && requestedShopId !== user.shopId) {
      return NextResponse.json({ ok: false, error: "You cannot view another shop's M-Pesa payments." }, { status: 403 });
    }
    if (!Number.isSafeInteger(expectedAmountMinor) || expectedAmountMinor <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid expected M-Pesa amount." }, { status: 400 });
    }
    const candidates = await getRecentMpesaConfirmationCandidates({ shopId: user.shopId, expectedAmountMinor });
    return NextResponse.json({ ok: true, candidates });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to load recent M-Pesa payments." }, { status });
  }
}