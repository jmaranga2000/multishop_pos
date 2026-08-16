import { AppError } from "@/lib/errors/app-error";

export type MpesaEnvironmentConfig = {
  enabled: boolean;
  stkEnabled: boolean;
  payToTillEnabled: boolean;
  environment: string;
  businessShortcode: string | null;
  partyB: string | null;
  consumerKey: string | null;
  consumerSecret: string | null;
  passkey: string | null;
  tillNumber: string | null;
  stkCallbackUrl: string | null;
  c2bConfirmationUrl: string | null;
  c2bValidationUrl: string | null;
  statusResultUrl: string | null;
  statusTimeoutUrl: string | null;
  callbackSecret: string | null;
};

function parseBooleanEnv(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

export function getMpesaEnvConfig(): MpesaEnvironmentConfig {
  return {
    enabled: parseBooleanEnv(process.env.MPESA_ENABLED),
    stkEnabled: parseBooleanEnv(process.env.MPESA_STK_ENABLED),
    payToTillEnabled: parseBooleanEnv(process.env.MPESA_PAY_TO_TILL_ENABLED),
    environment: process.env.MPESA_ENVIRONMENT?.trim() || "sandbox",
    businessShortcode: process.env.MPESA_BUSINESS_SHORTCODE?.trim() || null,
    partyB: process.env.MPESA_PARTY_B?.trim() || null,
    consumerKey: process.env.MPESA_CONSUMER_KEY?.trim() || null,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET?.trim() || null,
    passkey: process.env.MPESA_PASSKEY?.trim() || null,
    tillNumber: process.env.MPESA_TILL_NUMBER?.trim() || null,
    stkCallbackUrl: process.env.MPESA_STK_CALLBACK_URL?.trim() || null,
    c2bConfirmationUrl: process.env.MPESA_C2B_CONFIRMATION_URL?.trim() || null,
    c2bValidationUrl: process.env.MPESA_C2B_VALIDATION_URL?.trim() || null,
    statusResultUrl: process.env.MPESA_STATUS_RESULT_URL?.trim() || null,
    statusTimeoutUrl: process.env.MPESA_STATUS_TIMEOUT_URL?.trim() || null,
    callbackSecret: process.env.MPESA_CALLBACK_SECRET?.trim() || null,
  };
}

export function assertMpesaConfigured(mode: "STK_PUSH" | "PAY_TO_TILL" = "STK_PUSH") {
  const config = getMpesaEnvConfig();

  if (!config.enabled) {
    throw new AppError("M-Pesa is not enabled in the environment configuration.", "MPESA_NOT_ENABLED", 503);
  }
  if (mode === "STK_PUSH" && !config.stkEnabled) {
    throw new AppError("STK Push is not enabled in the environment configuration.", "MPESA_STK_DISABLED", 403);
  }
  if (mode === "PAY_TO_TILL" && !config.payToTillEnabled) {
    throw new AppError("Pay to Till is not enabled in the environment configuration.", "MPESA_PAY_TO_TILL_DISABLED", 403);
  }
  if (!config.consumerKey || !config.consumerSecret || !config.businessShortcode) {
    throw new AppError("M-Pesa provider credentials are incomplete. Configure the required environment variables.", "MPESA_CONFIG_INCOMPLETE", 503);
  }
  if (!config.callbackSecret || config.callbackSecret.length < 24) {
    throw new AppError("MPESA_CALLBACK_SECRET must be a long random value before M-Pesa can be enabled.", "MPESA_CALLBACK_SECRET_MISSING", 503);
  }
  if (mode === "STK_PUSH" && (!config.passkey || !config.stkCallbackUrl)) {
    throw new AppError("STK Push requires MPESA_PASSKEY and MPESA_STK_CALLBACK_URL.", "MPESA_STK_CONFIG_INCOMPLETE", 503);
  }
  if (mode === "PAY_TO_TILL" && (!config.tillNumber || !config.c2bConfirmationUrl || !config.c2bValidationUrl)) {
    throw new AppError("Pay to Till requires MPESA_TILL_NUMBER, MPESA_C2B_CONFIRMATION_URL, and MPESA_C2B_VALIDATION_URL.", "MPESA_TILL_CONFIG_INCOMPLETE", 503);
  }
  return config;
}

export function mpesaCallbackUrl(url: string, secret: string) {
  const parsed = new URL(url);
  parsed.searchParams.set("mpesa_token", secret);
  return parsed.toString();
}

export function assertValidMpesaCallback(request: Request) {
  const configuredSecret = getMpesaEnvConfig().callbackSecret;
  if (!configuredSecret) {
    throw new AppError("M-Pesa callback protection is not configured.", "MPESA_CALLBACK_SECRET_MISSING", 503);
  }
  const suppliedSecret = new URL(request.url).searchParams.get("mpesa_token");
  if (suppliedSecret !== configuredSecret) {
    throw new AppError("Invalid M-Pesa callback token.", "MPESA_CALLBACK_UNAUTHORIZED", 401);
  }
}