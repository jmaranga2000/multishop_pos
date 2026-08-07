import { NextResponse } from "next/server";
import { getRecentMpesaConfirmationCandidates } from "@/services/shop/mpesa-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId");
    const expectedAmountMinor = Number(searchParams.get("expectedAmountMinor") ?? "0");

    if (!shopId) {
      return NextResponse.json({ ok: false, error: "Missing shopId" }, { status: 400 });
    }

    const candidates = await getRecentMpesaConfirmationCandidates({ shopId, expectedAmountMinor });
    return NextResponse.json({ ok: true, candidates });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
