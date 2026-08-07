"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

type ApiResponse = {
  error?: string;
};

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json() as T & ApiResponse;
  if (!response.ok) throw new Error(result.error ?? "Fingerprint verification could not be completed.");
  return result;
}

export function canUseBiometrics() {
  return typeof window !== "undefined"
    && window.isSecureContext
    && "PublicKeyCredential" in window
    && "credentials" in navigator;
}

export async function enrollSalespersonFingerprint(salespersonId: string, pin: string) {
  const registration = await postJson<{ challengeId: string; options: any }>(
    "/api/shop/biometric/registration/options",
    { salespersonId, pin },
  );
  const credential = await startRegistration({ optionsJSON: registration.options });
  return postJson<{ success: boolean }>("/api/shop/biometric/registration/verify", {
    challengeId: registration.challengeId,
    response: credential,
  });
}

export async function authenticateSalespersonFingerprint(salespersonId: string) {
  const authentication = await postJson<{ challengeId: string; options: any }>(
    "/api/shop/biometric/authentication/options",
    { salespersonId },
  );
  const credential = await startAuthentication({ optionsJSON: authentication.options });
  const result = await postJson<{ success: boolean; authenticationToken: string }>(
    "/api/shop/biometric/authentication/verify",
    { challengeId: authentication.challengeId, response: credential },
  );
  return result.authenticationToken;
}