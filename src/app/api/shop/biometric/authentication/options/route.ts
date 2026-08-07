import { NextResponse } from "next/server";
import { requireShop } from "@/lib/rbac";
import { createBiometricAuthenticationOptions } from "@/services/shop/biometric-service";

function webAuthnConfig(request: Request) {
  const origin = process.env.WEBAUTHN_ORIGIN ?? request.headers.get("origin") ?? new URL(request.url).origin;
  return { origin, rpID: process.env.WEBAUTHN_RP_ID ?? new URL(origin).hostname };
}

export async function POST(request: Request) {
  try {
    const shopUser = await requireShop();
    const body = await request.json() as { salespersonId?: string };
    if (!body.salespersonId) {
      return NextResponse.json({ error: "Choose a salesperson first." }, { status: 400 });
    }
    return NextResponse.json(
      await createBiometricAuthenticationOptions(shopUser, {
        salespersonId: body.salespersonId,
        config: webAuthnConfig(request),
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start fingerprint authentication." },
      { status: 400 },
    );
  }
}
