import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { assertMpesaConfigured, getMpesaEnvConfig } from "@/lib/mpesa-env";
import { fromMinorUnits } from "@/lib/utils";
import { evaluateMpesaPaymentMatch } from "./mpesa-match";

type PaymentMode = "STK_PUSH" | "PAY_TO_TILL";

type StartMpesaPaymentInput = {
  shopId: string;
  saleId: string;
  cashierId?: string | null;
  shiftId?: string | null;
  customerPhone?: string | null;
  mode: PaymentMode;
  expectedAmountMinor: number;
  tillNumber?: string | null;
  clientReference?: string | null;
  idempotencyKey?: string | null;
};

function normalizePhone(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "").replace(/^254/, "0");
  return digits.length === 10 ? digits : null;
}

function createInternalReference(prefix: string) {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function createExpiry() {
  return new Date(Date.now() + 10 * 60 * 1000);
}

export async function startMpesaPayment(input: StartMpesaPaymentInput) {
  const config = assertMpesaConfigured(input.mode);
  const shop = await db.shop.findUnique({ where: { id: input.shopId }, select: { id: true, businessId: true, name: true, code: true } });
  if (!shop) throw new AppError("Shop was not found.", "SHOP_NOT_FOUND", 404);

  const sale = await db.sale.findUnique({ where: { id: input.saleId }, select: { id: true, status: true, total: true, shopId: true } });
  if (!sale) throw new AppError("Sale was not found.", "SALE_NOT_FOUND", 404);
  if (sale.shopId !== input.shopId) throw new AppError("Sale does not belong to this shop.", "SALE_SHOP_MISMATCH", 409);

  const normalizedPhone = normalizePhone(input.customerPhone);
  const internalReference = createInternalReference(input.mode === "STK_PUSH" ? "STK" : "TILL");
  const idempotencyKey = input.idempotencyKey ?? `${input.saleId}:${input.mode}:${internalReference}`;
  const expiryAt = createExpiry();

  const response = await db.mpesaPayment.create({
    data: {
      shopId: input.shopId,
      saleId: input.saleId,
      cashierId: input.cashierId ?? null,
      shiftId: input.shiftId ?? null,
      customerPhone: normalizedPhone,
      mode: input.mode,
      status: input.mode === "STK_PUSH" ? "READY" : "WAITING_FOR_CUSTOMER",
      matchStatus: "PENDING",
      expectedAmountMinor: input.expectedAmountMinor,
      receivedAmountMinor: 0,
      tillNumber: input.tillNumber ?? null,
      internalReference,
      clientReference: input.clientReference ?? null,
      idempotencyKey,
      expiryAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  if (input.mode === "STK_PUSH") {
    await db.mpesaPayment.update({
      where: { id: response.id },
      data: { status: "SENDING_REQUEST", updatedAt: new Date() },
    });
  }

  return {
    payment: response,
    expectedAmount: fromMinorUnits(input.expectedAmountMinor),
    normalizedPhone,
    internalReference,
    shop,
    config,
  };
}

export async function handleMpesaCallback(payload: Record<string, unknown>, shopId?: string | null) {
  const config = getMpesaEnvConfig();
  const transactionId = String((payload as any)?.TransactionID ?? payload?.transactionId ?? "").trim();
  if (!transactionId) throw new AppError("Missing M-Pesa transaction ID.", "MISSING_TRANSACTION_ID", 400);

  const existing = await db.mpesaCallbackEvent.findUnique({ where: { transactionId } });
  if (existing) {
    return { duplicate: true, eventId: existing.id, processingStatus: existing.processingStatus };
  }

  const incomingAmountMinor = Number((payload as any)?.TransAmount ?? payload?.transactionAmount ?? 0) * 100;
  const incomingPhone = String((payload as any)?.MSISDN ?? payload?.customerPhone ?? "");
  const incomingTillNumber = String((payload as any)?.BillRefNumber ?? payload?.tillNumber ?? "");
  const pendingPayments = await db.mpesaPayment.findMany({
    where: {
      shopId: shopId ?? undefined,
      status: { in: ["PENDING", "WAITING_FOR_CUSTOMER", "REQUEST_SENT", "MATCHING", "CONFIRMATION_DELAYED", "CHECKING_PAYMENT_STATUS"] },
    },
    orderBy: { createdAt: "desc" },
  });

  const matchingPayments = pendingPayments.filter((payment) => {
    if (!payment.expectedAmountMinor) return false;
    const amountMatches = payment.expectedAmountMinor === incomingAmountMinor;
    return amountMatches;
  });

  const primaryCandidate = matchingPayments[0];
  const decision = evaluateMpesaPaymentMatch({
    incomingAmountMinor,
    customerPhone: incomingPhone,
    tillNumber: incomingTillNumber,
    expectedAmountMinor: primaryCandidate?.expectedAmountMinor ?? 0,
    paymentPhone: primaryCandidate?.customerPhone ?? null,
    paymentTillNumber: primaryCandidate?.tillNumber ?? null,
    hasOtherCandidate: matchingPayments.length > 1,
  });

  const event = await db.mpesaCallbackEvent.create({
    data: {
      shopId: shopId ?? "",
      transactionId,
      transactionType: String((payload as any)?.TransactionType ?? payload?.transactionType ?? ""),
      transactionTime: String((payload as any)?.TransTime ?? payload?.transactionTime ?? ""),
      transactionAmount: String((payload as any)?.TransAmount ?? payload?.transactionAmount ?? ""),
      businessShortCode: String((payload as any)?.BusinessShortCode ?? payload?.businessShortcode ?? config.businessShortcode ?? ""),
      tillNumber: incomingTillNumber,
      customerPhone: incomingPhone,
      customerName: String((payload as any)?.FirstName ?? payload?.customerName ?? ""),
      billReference: incomingTillNumber,
      invoiceNumber: String((payload as any)?.InvoiceNumber ?? payload?.invoiceNumber ?? ""),
      organizationBalance: String((payload as any)?.OrgAccountBalance ?? payload?.organizationBalance ?? ""),
      callbackPayload: payload,
      processingStatus: decision.kind === "match" ? "PROCESSED" : decision.kind === "ambiguous" ? "FAILED" : "FAILED",
      matchedPaymentId: primaryCandidate?.id ?? null,
      matchedSaleId: primaryCandidate?.saleId ?? null,
      createdAt: new Date(),
      processedAt: new Date(),
    },
  });

  if (decision.kind === "match" && primaryCandidate) {
    await db.mpesaPayment.update({
      where: { id: primaryCandidate.id },
      data: {
        status: "MATCHED",
        matchStatus: "MATCHED",
        transactionId,
        receivedAmountMinor: incomingAmountMinor,
        receivedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } else if (decision.kind === "ambiguous") {
    await db.mpesaPayment.updateMany({
      where: { id: { in: matchingPayments.map((payment) => payment.id) } },
      data: { status: "AMBIGUOUS", matchStatus: "AMBIGUOUS", updatedAt: new Date() },
    });
  } else {
    await db.mpesaPayment.updateMany({
      where: { id: { in: pendingPayments.map((payment) => payment.id) } },
      data: { status: "UNMATCHED", matchStatus: "UNMATCHED", updatedAt: new Date() },
    });
  }

  return {
    duplicate: false,
    eventId: event.id,
    env: config.environment,
    match: decision,
    matchedPaymentId: primaryCandidate?.id ?? null,
    processingStatus: event.processingStatus,
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
