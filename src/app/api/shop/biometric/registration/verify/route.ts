import { NextResponse } from "next/server";
import { requireShop } from "@/lib/rbac";
import { verifyBiometricRegistration } from "@/services/shop/biometric-service";

function webAuthnConfig(request: Request) {
  const origin = process.env.WEBAUTHN_ORIGIN ?? request.headers.get("origin") ?? new URL(request.url).origin;
  return { origin, rpID: process.env.WEBAUTHN_RP_ID ?? new URL(origin).hostname };
}

export async function POST(request: Request) {
  try {
    const shopUser = await requireShop();
    const body = await request.json() as { challengeId?: string; response?: never };
    if (!body.challengeId || !body.response) {
      return NextResponse.json({ error: "Fingerprint response is required." }, { status: 400 });
    }
    return NextResponse.json(
      await verifyBiometricRegistration(shopUser, {
        challengeId: body.challengeId,
        response: body.response,
        config: webAuthnConfig(request),
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify fingerprint setup." },
      { status: 400 },
    );
  }
}
