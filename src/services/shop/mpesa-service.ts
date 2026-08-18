import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import {
  assertMpesaConfigured,
  getMpesaEnvConfig,
  mpesaCallbackUrl,
  type MpesaEnvironmentConfig,
} from "@/lib/mpesa-env";
import { fromMinorUnits } from "@/lib/utils";
import { summarizeRecentPayers } from "./mpesa-confirmation";

type PaymentMode = "STK_PUSH" | "PAY_TO_TILL";

type StartMpesaPaymentInput = {
  shopId: string;
  cashierId: string;
  registerSessionId: string;
  saleLocalReference: string;
  customerPhone?: string | null;
  mode: PaymentMode;
  expectedAmountMinor: number;
  clientReference?: string | null;
  idempotencyKey?: string | null;
};

type DarajaTokenResponse = { access_token?: string; expires_in?: string | number };
type DarajaStkResponse = {
  ResponseCode?: string | number;
  ResponseDescription?: string;
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  errorMessage?: string;
};
type DarajaC2bRegistrationResponse = {
  ResponseCode?: string | number;
  ResponseDescription?: string;
  errorMessage?: string;
};

type StkCallback = {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: number | string;
  ResultDesc?: string;
  CallbackMetadata?: { Item?: Array<{ Name?: string; Value?: unknown }> };
};

let tokenCache: { token: string; expiresAt: number } | null = null;

function getPayloadValue(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function getPayloadString(payload: Record<string, unknown>, ...keys: string[]) {
  const value = getPayloadValue(payload, ...keys);
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function getPayloadNumber(payload: Record<string, unknown>, ...keys: string[]) {
  const value = getPayloadValue(payload, ...keys);
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizePhone(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "").replace(/^254/, "0");
  return digits.length === 10 && /^0[17]\d{8}$/.test(digits) ? digits : null;
}

function toDarajaPhone(value?: string | null) {
  const normalized = normalizePhone(value);
  return normalized ? `254${normalized.slice(1)}` : null;
}

function createInternalReference(prefix: string) {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function createExpiry() {
  return new Date(Date.now() + 10 * 60 * 1000);
}

function darajaBaseUrl(environment: string) {
  return environment.trim().toLowerCase() === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

function darajaTimestamp() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

function amountInKes(amountMinor: number) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new AppError("M-Pesa amount must be a positive whole number of cents.", "MPESA_AMOUNT_INVALID", 400);
  }
  if (amountMinor % 100 !== 0) {
    throw new AppError("M-Pesa payments must use whole Kenya shillings.", "MPESA_AMOUNT_NOT_WHOLE_KES", 400);
  }
  return amountMinor / 100;
}

function providerError(prefix: string, status: number, body: unknown) {
  const detail = typeof body === "object" && body
    ? (asRecord(body).errorMessage ?? asRecord(body).ResponseDescription ?? asRecord(body).errorCode)
    : null;
  return new AppError(detail ? `${prefix}: ${String(detail)}` : prefix, "MPESA_PROVIDER_ERROR", status >= 500 ? 502 : 400);
}

async function getDarajaAccessToken(config: MpesaEnvironmentConfig) {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const response = await fetch(`${darajaBaseUrl(config.environment)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}`, Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as DarajaTokenResponse;
  if (!response.ok || !payload.access_token) throw providerError("M-Pesa authentication failed", response.status, payload);
  const ttlSeconds = Math.max(60, Number(payload.expires_in ?? 3_000));
  tokenCache = { token: payload.access_token, expiresAt: Date.now() + ttlSeconds * 1_000 };
  return tokenCache.token;
}

async function darajaPost<T>(config: MpesaEnvironmentConfig, path: string, body: Record<string, unknown>) {
  const token = await getDarajaAccessToken(config);
  const response = await fetch(`${darajaBaseUrl(config.environment)}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as T;
  if (!response.ok) throw providerError("M-Pesa request failed", response.status, payload);
  return payload;
}

async function sendStkPush(config: MpesaEnvironmentConfig, input: {
  amountMinor: number;
  customerPhone: string;
  accountReference: string;
  description: string;
}) {
  const phone = toDarajaPhone(input.customerPhone);
  if (!phone) throw new AppError("Enter a valid Kenyan M-Pesa phone number.", "MPESA_PHONE_INVALID", 400);
  const timestamp = darajaTimestamp();
  const callbackUrl = mpesaCallbackUrl(config.stkCallbackUrl!, config.callbackSecret!);
  const response = await darajaPost<DarajaStkResponse>(config, "/mpesa/stkpush/v1/processrequest", {
    BusinessShortCode: config.businessShortcode,
    Password: Buffer.from(`${config.businessShortcode}${timestamp}${config.passkey}`).toString("base64"),
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amountInKes(input.amountMinor),
    PartyA: phone,
    PartyB: config.partyB || config.businessShortcode,
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: input.accountReference.slice(0, 12),
    TransactionDesc: input.description.slice(0, 100),
  });
  if (String(response.ResponseCode) !== "0" || !response.CheckoutRequestID) {
    throw providerError("M-Pesa rejected the STK Push request", 400, response);
  }
  return response;
}

async function registerC2bUrls(config: MpesaEnvironmentConfig) {
  const response = await darajaPost<DarajaC2bRegistrationResponse>(config, "/mpesa/c2b/v1/registerurl", {
    ShortCode: config.businessShortcode,
    ResponseType: "Completed",
    ConfirmationURL: mpesaCallbackUrl(config.c2bConfirmationUrl!, config.callbackSecret!),
    ValidationURL: mpesaCallbackUrl(config.c2bValidationUrl!, config.callbackSecret!),
  });
  if (String(response.ResponseCode) !== "0") {
    throw providerError("M-Pesa rejected C2B callback registration", 400, response);
  }
  return response;
}

function isFinalPaymentStatus(status?: string | null) {
  return ["SUCCESSFUL", "MATCHED"].includes(status ?? "");
}

function stkMetadata(callback: StkCallback) {
  const items = callback.CallbackMetadata?.Item ?? [];
  const read = (name: string) => items.find((item) => item.Name === name)?.Value;
  const amount = Number(read("Amount") ?? 0);
  const rawPhone = read("PhoneNumber");
  return {
    amountMinor: Number.isFinite(amount) ? Math.round(amount * 100) : 0,
    receiptNumber: String(read("MpesaReceiptNumber") ?? "").trim() || null,
    transactionDate: String(read("TransactionDate") ?? "").trim() || null,
    phone: typeof rawPhone === "number" || typeof rawPhone === "string" ? String(rawPhone) : null,
  };
}

export async function startMpesaPayment(input: StartMpesaPaymentInput) {
  const config = assertMpesaConfigured(input.mode);
  if (!input.saleLocalReference || input.saleLocalReference.length > 100) {
    throw new AppError("A valid sale reference is required for M-Pesa payment.", "MPESA_SALE_REFERENCE_INVALID", 400);
  }
  const amountMinor = Number(input.expectedAmountMinor);
  amountInKes(amountMinor);

  const [shop, session] = await Promise.all([
    db.shop.findUnique({ where: { id: input.shopId }, select: { id: true, name: true, code: true } }),
    db.registerSession.findFirst({ where: { id: input.registerSessionId, shopId: input.shopId, status: "OPEN" }, select: { id: true, counterId: true } }),
  ]);
  if (!shop) throw new AppError("Shop was not found.", "SHOP_NOT_FOUND", 404);
  if (!session) throw new AppError("Open a register session before starting an M-Pesa payment.", "REGISTER_SESSION_INVALID", 409);

  const normalizedPhone = normalizePhone(input.customerPhone);
  if (input.mode === "STK_PUSH" && !normalizedPhone) {
    throw new AppError("Enter a valid Kenyan M-Pesa phone number.", "MPESA_PHONE_INVALID", 400);
  }

  const idempotencyKey = input.idempotencyKey ?? `${input.shopId}:${input.saleLocalReference}:${input.mode}`;
  const existing = await db.mpesaPayment.findFirst({ where: { shopId: input.shopId, idempotencyKey } });
  if (existing && !["FAILED", "CANCELLED", "TIMED_OUT"].includes(existing.status)) {
    return {
      payment: existing,
      expectedAmount: fromMinorUnits(existing.expectedAmountMinor),
      normalizedPhone: existing.customerPhone,
      internalReference: existing.internalReference,
      shop,
      config,
      duplicate: true,
    };
  }

  const internalReference = createInternalReference(input.mode === "STK_PUSH" ? "STK" : "TILL");
  const payment = await db.mpesaPayment.create({
    data: {
      shopId: input.shopId,
      counterId: session.counterId || undefined,
      saleId: input.saleLocalReference,
      cashierId: input.cashierId,
      shiftId: input.registerSessionId,
      customerPhone: normalizedPhone,
      mode: input.mode,
      status: input.mode === "STK_PUSH" ? "SENDING_REQUEST" : "WAITING_FOR_CUSTOMER",
      matchStatus: "PENDING",
      expectedAmountMinor: amountMinor,
      receivedAmountMinor: 0,
      tillNumber: input.mode === "PAY_TO_TILL" ? config.tillNumber : null,
      internalReference,
      clientReference: input.clientReference ?? input.saleLocalReference,
      idempotencyKey,
      expiryAt: createExpiry(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  try {
    if (input.mode === "STK_PUSH") {
      const response = await sendStkPush(config, {
        amountMinor,
        customerPhone: normalizedPhone!,
        accountReference: shop.code || internalReference,
        description: `POS sale at ${shop.name}`,
      });
      const updated = await db.mpesaPayment.update({
        where: { id: payment.id },
        data: {
          status: "REQUEST_SENT",
          merchantRequestId: response.MerchantRequestID ?? null,
          checkoutRequestId: response.CheckoutRequestID,
          resultDescription: response.ResponseDescription ?? null,
          updatedAt: new Date(),
        },
      });
      return { payment: updated, expectedAmount: fromMinorUnits(amountMinor), normalizedPhone, internalReference, shop, config, duplicate: false };
    }

    await registerC2bUrls(config);
    const updated = await db.mpesaPayment.update({
      where: { id: payment.id },
      data: { status: "WAITING_FOR_CUSTOMER", resultDescription: "Waiting for payment at till.", updatedAt: new Date() },
    });
    return { payment: updated, expectedAmount: fromMinorUnits(amountMinor), normalizedPhone, internalReference, shop, config, duplicate: false };
  } catch (error) {
    await db.mpesaPayment.update({
      where: { id: payment.id },
      data: { status: "FAILED", resultDescription: error instanceof Error ? error.message : "M-Pesa request failed.", updatedAt: new Date() },
    }).catch(() => undefined);
    throw error;
  }
}

export async function handleStkCallback(payload: Record<string, unknown>) {
  const body = asRecord(payload.Body);
  const callback = asRecord(body.stkCallback) as StkCallback;
  const checkoutRequestId = String(callback.CheckoutRequestID ?? "").trim();
  if (!checkoutRequestId) throw new AppError("Missing STK checkout request ID.", "MPESA_STK_CALLBACK_INVALID", 400);

  const eventTransactionId = `STK:${checkoutRequestId}`;
  const existing = await db.mpesaCallbackEvent.findUnique({ where: { transactionId: eventTransactionId } });
  if (existing) return { duplicate: true, eventId: existing.id, processingStatus: existing.processingStatus };

  const payment = await db.mpesaPayment.findFirst({ where: { checkoutRequestId, mode: "STK_PUSH" } });
  if (!payment) {
    return { duplicate: false, eventId: null, processingStatus: "IGNORED" as const };
  }

  const resultCode = String(callback.ResultCode ?? "");
  const metadata = stkMetadata(callback);
  const successful = resultCode === "0";
  const amountMatches = successful && metadata.amountMinor === payment.expectedAmountMinor;
  const nextStatus = successful && amountMatches ? "SUCCESSFUL" : successful ? "UNDERPAID" : resultCode === "1032" ? "CANCELLED" : "FAILED";
  const event = await db.mpesaCallbackEvent.create({
    data: {
      shopId: payment.shopId,
      transactionId: eventTransactionId,
      transactionType: "STK_PUSH",
      transactionTime: metadata.transactionDate,
      transactionAmount: metadata.amountMinor ? String(metadata.amountMinor / 100) : null,
      businessShortCode: getMpesaEnvConfig().businessShortcode,
      customerPhone: metadata.phone,
      callbackPayload: payload,
      processingStatus: successful && amountMatches ? "PROCESSED" : "FAILED",
      matchedPaymentId: payment.id,
      matchedSaleId: payment.saleId,
      createdAt: new Date(),
      processedAt: new Date(),
    },
  });

  await db.mpesaPayment.update({
    where: { id: payment.id },
    data: {
      status: nextStatus,
      matchStatus: successful && amountMatches ? "MATCHED" : "UNMATCHED",
      transactionId: metadata.receiptNumber ?? payment.transactionId,
      receiptNumber: metadata.receiptNumber,
      receivedAmountMinor: metadata.amountMinor,
      receivedAt: new Date(),
      completedAt: successful && amountMatches ? new Date() : null,
      resultCode,
      resultDescription: callback.ResultDesc ?? (amountMatches ? "Payment confirmed." : "M-Pesa amount did not match the requested amount."),
      callbackPayload: payload,
      updatedAt: new Date(),
    },
  });

  return { duplicate: false, eventId: event.id, processingStatus: event.processingStatus };
}

export async function handleMpesaCallback(payload: Record<string, unknown>) {
  if (asRecord(asRecord(payload.Body).stkCallback).CheckoutRequestID) return handleStkCallback(payload);

  const transactionId = getPayloadString(payload, "TransactionID", "transactionId").trim();
  if (!transactionId) return { duplicate: false, eventId: null, processingStatus: "IGNORED" as const };
  const existing = await db.mpesaCallbackEvent.findUnique({ where: { transactionId } });
  if (existing) return { duplicate: true, eventId: existing.id, processingStatus: existing.processingStatus };

  const incomingAmountMinor = Math.round(getPayloadNumber(payload, "TransAmount", "transactionAmount") * 100);
  const incomingPhone = normalizePhone(getPayloadString(payload, "MSISDN", "customerPhone"));
  const incomingTillNumber = getPayloadString(payload, "BillRefNumber", "tillNumber").trim();
  const incomingBusinessShortCode = getPayloadString(payload, "BusinessShortCode", "businessShortcode").trim();
  const incomingDestinationNumbers = [incomingTillNumber, incomingBusinessShortCode].filter(Boolean);
  const pendingPayments = await db.mpesaPayment.findMany({
    where: {
      mode: "PAY_TO_TILL",
      status: { in: ["WAITING_FOR_CUSTOMER", "REQUEST_SENT", "MATCHING", "CONFIRMATION_DELAYED", "CHECKING_PAYMENT_STATUS"] },
      expiryAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  const candidates = pendingPayments.filter((payment) =>
    payment.expectedAmountMinor === incomingAmountMinor
    && (!payment.tillNumber || incomingDestinationNumbers.length === 0 || incomingDestinationNumbers.includes(payment.tillNumber))
    && (!payment.customerPhone || payment.customerPhone === incomingPhone),
  );
  const payment = candidates.length === 1 ? candidates[0] : null;
  const shopId = payment?.shopId ?? "unmatched";
  const customerName = [
    getPayloadString(payload, "FirstName", "firstName"),
    getPayloadString(payload, "MiddleName", "middleName"),
    getPayloadString(payload, "LastName", "lastName"),
  ].filter(Boolean).join(" ") || getPayloadString(payload, "customerName");
  const event = await db.mpesaCallbackEvent.create({
    data: {
      shopId,
      transactionId,
      transactionType: getPayloadString(payload, "TransactionType", "transactionType"),
      transactionTime: getPayloadString(payload, "TransTime", "transactionTime"),
      transactionAmount: getPayloadString(payload, "TransAmount", "transactionAmount"),
      businessShortCode: getPayloadString(payload, "BusinessShortCode", "businessShortcode") || getMpesaEnvConfig().businessShortcode,
      tillNumber: incomingTillNumber,
      customerPhone: incomingPhone,
      customerName,
      billReference: getPayloadString(payload, "BillRefNumber", "billReference"),
      invoiceNumber: getPayloadString(payload, "InvoiceNumber", "invoiceNumber"),
      organizationBalance: getPayloadString(payload, "OrgAccountBalance", "organizationBalance"),
      callbackPayload: payload,
      processingStatus: payment ? "PROCESSED" : "FAILED",
      matchedPaymentId: payment?.id ?? null,
      matchedSaleId: payment?.saleId ?? null,
      createdAt: new Date(),
      processedAt: new Date(),
    },
  });

  if (payment) {
    await db.mpesaPayment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESSFUL",
        matchStatus: "MATCHED",
        transactionId,
        receiptNumber: transactionId,
        receivedAmountMinor: incomingAmountMinor,
        receivedAt: new Date(),
        completedAt: new Date(),
        resultCode: "0",
        resultDescription: "Till payment confirmed.",
        callbackPayload: payload,
        updatedAt: new Date(),
      },
    });
  } else if (candidates.length > 1) {
    await db.mpesaPayment.updateMany({
      where: { id: { in: candidates.map((candidate) => candidate.id) } },
      data: { status: "AMBIGUOUS", matchStatus: "AMBIGUOUS", updatedAt: new Date() },
    });
  }

  return { duplicate: false, eventId: event.id, processingStatus: event.processingStatus };
}

export async function getMpesaPaymentStatus(shopId: string, paymentId: string) {
  const payment = await db.mpesaPayment.findFirst({ where: { id: paymentId, shopId } });
  if (!payment) throw new AppError("M-Pesa payment was not found for this shop.", "MPESA_PAYMENT_NOT_FOUND", 404);
  const expired = !isFinalPaymentStatus(payment.status) && new Date(payment.expiryAt).getTime() < Date.now();
  if (expired && !["TIMED_OUT", "FAILED", "CANCELLED"].includes(payment.status)) {
    return db.mpesaPayment.update({
      where: { id: payment.id },
      data: { status: "TIMED_OUT", resultDescription: "M-Pesa payment request expired.", updatedAt: new Date() },
    });
  }
  return payment;
}

export function presentMpesaPaymentStatus(payment: Awaited<ReturnType<typeof getMpesaPaymentStatus>>) {
  return {
    id: payment.id,
    mode: payment.mode,
    status: payment.status,
    confirmed: isFinalPaymentStatus(payment.status) && payment.receivedAmountMinor >= payment.expectedAmountMinor,
    expectedAmountMinor: payment.expectedAmountMinor,
    receivedAmountMinor: payment.receivedAmountMinor,
    internalReference: payment.internalReference,
    transactionId: payment.transactionId ?? payment.receiptNumber ?? null,
    resultDescription: payment.resultDescription ?? null,
    expiresAt: payment.expiryAt,
  };
}

export async function completeMpesaPayment(paymentId: string, input: { status?: string; transactionId?: string | null; receiptNumber?: string | null; resultCode?: string | null; resultDescription?: string | null; receivedAmountMinor?: number; callbackPayload?: Record<string, unknown> | null }) {
  const payment = await db.mpesaPayment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new AppError("Payment record was not found.", "PAYMENT_NOT_FOUND", 404);
  const update: Record<string, unknown> = {
    updatedAt: new Date(),
    status: input.status ?? payment.status,
    transactionId: input.transactionId ?? payment.transactionId,
    receiptNumber: input.receiptNumber ?? payment.receiptNumber,
    resultCode: input.resultCode ?? payment.resultCode,
    resultDescription: input.resultDescription ?? payment.resultDescription,
    callbackPayload: input.callbackPayload ?? payment.callbackPayload,
  };
  if (input.receivedAmountMinor !== undefined) update.receivedAmountMinor = input.receivedAmountMinor;
  if (input.status === "SUCCESSFUL") update.completedAt = new Date();
  return db.mpesaPayment.update({ where: { id: paymentId }, data: update });
}

export async function getPendingMpesaPayments(shopId: string) {
  return db.mpesaPayment.findMany({ where: { shopId, status: { in: ["PENDING", "WAITING_FOR_CUSTOMER", "REQUEST_SENT", "MATCHING", "CONFIRMATION_DELAYED", "CHECKING_PAYMENT_STATUS"] } }, orderBy: { createdAt: "desc" } });
}

export async function normalizeMpesaPhone(value?: string | null) {
  return normalizePhone(value);
}

export async function getRecentMpesaConfirmationCandidates(input: { shopId: string; expectedAmountMinor: number }) {
  const recentEvents = await db.mpesaCallbackEvent.findMany({
    where: { shopId: input.shopId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { customerName: true, customerPhone: true, transactionAmount: true, createdAt: true },
  });
  return summarizeRecentPayers(recentEvents.map((event) => ({
    customerName: event.customerName,
    customerPhone: event.customerPhone,
    transactionAmount: event.transactionAmount,
    createdAt: event.createdAt,
  })), input.expectedAmountMinor);
}