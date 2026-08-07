import { NextResponse } from "next/server";
import { requireShop } from "@/lib/rbac";
import { createBiometricRegistrationOptions } from "@/services/shop/biometric-service";

function webAuthnConfig(request: Request) {
  const origin = process.env.WEBAUTHN_ORIGIN ?? request.headers.get("origin") ?? new URL(request.url).origin;
  return { origin, rpID: process.env.WEBAUTHN_RP_ID ?? new URL(origin).hostname };
}

export async function POST(request: Request) {
  try {
    const shopUser = await requireShop();
    const body = await request.json() as { salespersonId?: string; pin?: string };
    if (!body.salespersonId || !body.pin) {
      return NextResponse.json({ error: "Salesperson and PIN are required to set up fingerprint." }, { status: 400 });
    }
    return NextResponse.json(
      await createBiometricRegistrationOptions(shopUser, {
        salespersonId: body.salespersonId,
        pin: body.pin,
        config: webAuthnConfig(request),
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start fingerprint setup." },
      { status: 400 },
    );
  }
}
