import argon2 from "argon2";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { writeAuditLog } from "@/services/shared/audit-service";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SUPPORTED_AUTHENTICATOR_TRANSPORTS = new Set<AuthenticatorTransportFuture>([
  "ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb",
]);

type WebAuthnConfig = {
  origin: string;
  rpID: string;
};

type BiometricChallenge = {
  id: string;
  purpose: string;
  shopId: string;
  salespersonId: string;
  challenge: string;
  expiresAt: Date;
  verifiedAt?: Date | null;
  usedAt?: Date | null;
};

type ShopAuthContext = {
  id: string;
  businessId: string;
  shopId: string;
  shop: { id: string; name: string; code: string; isActive: boolean };
};

function normalizeAuthenticatorTransports(transports?: string[] | null): AuthenticatorTransportFuture[] {
  return (transports ?? []).filter((transport): transport is AuthenticatorTransportFuture =>
    SUPPORTED_AUTHENTICATOR_TRANSPORTS.has(transport as AuthenticatorTransportFuture),
  );
}

function getChallengeExpiry() {
  return new Date(Date.now() + CHALLENGE_TTL_MS);
}

function getValidChallenge(
  challenge: BiometricChallenge | null,

  purpose: "REGISTRATION" | "AUTHENTICATION",
  shopId: string,
) {
  if (
    !challenge
    || challenge.purpose !== purpose
    || challenge.shopId !== shopId
    || challenge.expiresAt.getTime() <= Date.now()
  ) {
    throw new AppError("The fingerprint request has expired. Please try again.", "BIOMETRIC_CHALLENGE_EXPIRED", 401);
  }
  return challenge;
}

export async function createBiometricRegistrationOptions(
  shopUser: ShopAuthContext,
  input: { salespersonId: string; pin: string; config: WebAuthnConfig },
) {
  const salesperson = await db.salespersonProfile.findFirst({
    where: { id: input.salespersonId, shopId: shopUser.shopId, isActive: true },
  });
  if (!salesperson || !(await argon2.verify(salesperson.pinHash, input.pin))) {
    throw new AppError("Choose an active salesperson and enter the correct PIN before setting up fingerprint.", "BIOMETRIC_PIN_INVALID", 401);
  }

  const credentials = await db.salespersonBiometricCredential.findMany({
    where: { salespersonId: salesperson.id },
  });
  const options = await generateRegistrationOptions({
    rpName: "MultiShop POS",
    rpID: input.config.rpID,
    userName: salesperson.code,
    userDisplayName: salesperson.name,
    userID: Buffer.from(salesperson.id),
    attestationType: "none",
    excludeCredentials: credentials.map((credential) => ({
      id: credential.credentialId,
      transports: normalizeAuthenticatorTransports(credential.transports),
    })),
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "preferred",
      userVerification: "required",
    },
    supportedAlgorithmIDs: [-7, -257],
  });

  const challenge = await db.salespersonBiometricChallenge.create({
    data: {
      salespersonId: salesperson.id,
      shopId: shopUser.shopId,
      purpose: "REGISTRATION",
      challenge: options.challenge,
      expiresAt: getChallengeExpiry(),
    },
  });

  return { challengeId: challenge.id, options };
}

export async function verifyBiometricRegistration(
  shopUser: ShopAuthContext,
  input: {
    challengeId: string;
    response: RegistrationResponseJSON;
    config: WebAuthnConfig;
  },
) {
  const challenge = getValidChallenge(
    await db.salespersonBiometricChallenge.findFirst({ where: { id: input.challengeId } }),
    "REGISTRATION",
    shopUser.shopId,
  );
  if (challenge.verifiedAt) {
    throw new AppError("This fingerprint registration has already been completed.", "BIOMETRIC_CHALLENGE_USED", 409);
  }

  const verification = await verifyRegistrationResponse({
    response: input.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: input.config.origin,
    expectedRPID: input.config.rpID,
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw new AppError("Fingerprint registration could not be verified.", "BIOMETRIC_VERIFICATION_FAILED", 401);
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const existingCredential = await db.salespersonBiometricCredential.findFirst({
    where: { credentialId: credential.id },
  });
  const credentialData = {
    salespersonId: challenge.salespersonId,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: normalizeAuthenticatorTransports(credential.transports),
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    lastUsedAt: null,
  };

  if (existingCredential && existingCredential.salespersonId !== challenge.salespersonId) {
    throw new AppError("This device credential is already assigned to another salesperson.", "BIOMETRIC_CREDENTIAL_ASSIGNED", 409);
  }

  if (existingCredential) {
    await db.salespersonBiometricCredential.update({
      where: { id: existingCredential.id },
      data: credentialData,
    });
  } else {
    await db.salespersonBiometricCredential.create({ data: credentialData });
  }

  await db.salespersonBiometricChallenge.update({
    where: { id: challenge.id },
    data: { verifiedAt: new Date() },
  });
  await writeAuditLog(db, {
    userId: shopUser.id,
    shopId: shopUser.shopId,
    action: "SALESPERSON_FINGERPRINT_ENROLLED",
    entityType: "SALESPERSON_PROFILE",
    entityId: challenge.salespersonId,
    description: "Enrolled a fingerprint-capable device for salesperson authentication.",
  });

  return { success: true };
}

export async function createBiometricAuthenticationOptions(
  shopUser: ShopAuthContext,
  input: { salespersonId: string; config: WebAuthnConfig },
) {
  const salesperson = await db.salespersonProfile.findFirst({
    where: { id: input.salespersonId, shopId: shopUser.shopId, isActive: true },
  });
  if (!salesperson) throw new AppError("The selected salesperson is not active.", "SALESPERSON_NOT_FOUND", 404);

  const credentials = await db.salespersonBiometricCredential.findMany({
    where: { salespersonId: salesperson.id },
  });
  if (!credentials.length) {
    throw new AppError("No fingerprint is set up for this salesperson. Use the PIN or set up fingerprint first.", "BIOMETRIC_NOT_ENROLLED", 404);
  }

  const options = await generateAuthenticationOptions({
    rpID: input.config.rpID,
    allowCredentials: credentials.map((credential) => ({
      id: credential.credentialId,
      transports: normalizeAuthenticatorTransports(credential.transports),
    })),
    userVerification: "required",
  });
  const challenge = await db.salespersonBiometricChallenge.create({
    data: {
      salespersonId: salesperson.id,
      shopId: shopUser.shopId,
      purpose: "AUTHENTICATION",
      challenge: options.challenge,
      expiresAt: getChallengeExpiry(),
    },
  });

  return { challengeId: challenge.id, options };
}

export async function verifyBiometricAuthentication(
  shopUser: ShopAuthContext,
  input: {
    challengeId: string;
    response: AuthenticationResponseJSON;
    config: WebAuthnConfig;
  },
) {
  const challenge = getValidChallenge(
    await db.salespersonBiometricChallenge.findFirst({ where: { id: input.challengeId } }),
    "AUTHENTICATION",
    shopUser.shopId,
  );
  if (challenge.verifiedAt) {
    throw new AppError("This fingerprint authentication has already been used.", "BIOMETRIC_CHALLENGE_USED", 409);
  }

  const credential = await db.salespersonBiometricCredential.findFirst({
    where: {
      credentialId: input.response.id,
      salespersonId: challenge.salespersonId,
    },
  });
  if (!credential) {
    throw new AppError("This fingerprint credential does not belong to the selected salesperson.", "BIOMETRIC_CREDENTIAL_INVALID", 401);
  }

  const verification = await verifyAuthenticationResponse({
    response: input.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: input.config.origin,
    expectedRPID: input.config.rpID,
    credential: {
      id: credential.credentialId,
      publicKey: Buffer.from(credential.publicKey, "base64url"),
      counter: credential.counter,
      transports: normalizeAuthenticatorTransports(credential.transports),
    },
    requireUserVerification: true,
  });
  if (!verification.verified) {
    throw new AppError("Fingerprint authentication could not be verified.", "BIOMETRIC_VERIFICATION_FAILED", 401);
  }

  const verifiedAt = new Date();
  await Promise.all([
    db.salespersonBiometricCredential.update({
      where: { id: credential.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: verifiedAt,
      },
    }),
    db.salespersonBiometricChallenge.update({
      where: { id: challenge.id },
      data: { verifiedAt },
    }),
  ]);

  return { success: true, authenticationToken: challenge.id };
}

export async function consumeBiometricAuthentication(
  input: {
    authenticationToken?: string | null;
    salespersonId: string;
    shopId: string;
  },
) {
  if (!input.authenticationToken) return false;
  const challenge = getValidChallenge(
    await db.salespersonBiometricChallenge.findFirst({
      where: {
        id: input.authenticationToken,
        salespersonId: input.salespersonId,
        shopId: input.shopId,
      },
    }),
    "AUTHENTICATION",
    input.shopId,
  );
  if (!challenge.verifiedAt || challenge.usedAt) return false;

  await db.salespersonBiometricChallenge.update({
    where: { id: challenge.id },
    data: { usedAt: new Date() },
  });
  return true;
}
