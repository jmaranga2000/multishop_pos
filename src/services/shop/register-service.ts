import argon2 from "argon2";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { fromMinorUnits } from "@/lib/utils";
import { consumeBiometricAuthentication } from "@/services/shop/biometric-service";
import { writeAuditLog } from "@/services/shared/audit-service";
import type { z } from "zod";
import type { openRegisterSchema, closeRegisterSchema } from "@/validators/shop/register-validator";

type OpenRegisterInput = z.infer<typeof openRegisterSchema>;
type CloseRegisterInput = z.infer<typeof closeRegisterSchema>;

type ShopContext = { id: string; shopId: string; businessId: string };

type PaymentChannel = "CASH" | "MPESA_STK_PUSH" | "MPESA_PAY_TO_TILL" | "CARD" | "BANK_TRANSFER";

export function buildEnabledPaymentChannels(
  shop: { mpesaEnabled?: boolean | null; mpesaStkEnabled?: boolean | null; mpesaPayToTillEnabled?: boolean | null },
  configuredChannels: string[] = [],
) {
  const enabled = new Set<PaymentChannel>([(configuredChannels.includes("CASH") ? "CASH" : "CASH") as PaymentChannel]);
  if (configuredChannels.includes("MPESA_STK_PUSH") || shop.mpesaEnabled && shop.mpesaStkEnabled) {
    enabled.add("MPESA_STK_PUSH");
  }
  if (configuredChannels.includes("MPESA_PAY_TO_TILL") || (shop.mpesaEnabled && shop.mpesaPayToTillEnabled)) {
    enabled.add("MPESA_PAY_TO_TILL");
  }
  if (configuredChannels.includes("CARD")) enabled.add("CARD");
  if (configuredChannels.includes("BANK_TRANSFER")) enabled.add("BANK_TRANSFER");
  return Array.from(enabled);
}

export function getPaymentChannelWarnings(shop: { mpesaEnabled?: boolean | null; mpesaStkEnabled?: boolean | null; mpesaPayToTillEnabled?: boolean | null; mpesaTillNumber?: string | null }) {
  const warnings: string[] = [];
  if (shop.mpesaEnabled) {
    if (!shop.mpesaStkEnabled && !shop.mpesaPayToTillEnabled) {
      warnings.push("M-Pesa is enabled but no services are currently active.");
    }
    if (!shop.mpesaStkEnabled) {
      warnings.push("STK Push is disabled.");
    }
    if (!shop.mpesaPayToTillEnabled) {
      warnings.push("Pay to Till is disabled.");
    }
    if (!shop.mpesaTillNumber) {
      warnings.push("Till number is not configured for this shop.");
    }
  }
  return warnings;
}

function toNumber(value: number | string | null | undefined) {
  const numeric = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(numeric) ? Number(numeric) : 0;
}

export function calculateCashSalesTotal(sales: Array<{ id: string; total?: number | string | null }>, payments: Array<{ saleId: string; method?: string | null; status?: string | null; amount?: number | string | null }>) {
  const verifiedCashPayments = payments.filter((payment) => payment.method === "CASH" && payment.status === "VERIFIED");
  return verifiedCashPayments.reduce((sum, payment) => {
    const sale = sales.find((entry) => entry.id === payment.saleId);
    const saleTotal = toNumber(sale?.total ?? payment.amount ?? 0);
    return sum + saleTotal;
  }, 0);
}

export function calculateExpectedCash(input: {
  openingCash?: number | string | null;
  cashSalesTotal?: number | string | null;
  cashExpenseTotal?: number | string | null;
  cashInTotal?: number | string | null;
  cashOutTotal?: number | string | null;
}) {
  return Number(input.openingCash ?? 0)
    + Number(input.cashSalesTotal ?? 0)
    + Number(input.cashInTotal ?? 0)
    - Number(input.cashExpenseTotal ?? 0)
    - Number(input.cashOutTotal ?? 0);
}

export function calculateExpectedMpesa(input: {
  openingMpesaBalance?: number | string | null;
  mpesaPayments?: Array<{ status?: string | null; receivedAmountMinor?: number | string | null; expectedAmountMinor?: number | string | null }>;
  mpesaExpenseTotal?: number | string | null;
}) {
  const confirmedStatuses = new Set(["SUCCESSFUL", "MATCHED", "RECEIVED"]);
  const confirmedTotal = (input.mpesaPayments ?? []).reduce((sum, payment) => {
    if (!confirmedStatuses.has(String(payment.status ?? ""))) return sum;
    const amount = toNumber(payment.receivedAmountMinor ?? payment.expectedAmountMinor ?? 0);
    return sum + fromMinorUnits(amount);
  }, 0);

  return Number(input.openingMpesaBalance ?? 0) + confirmedTotal - Number(input.mpesaExpenseTotal ?? 0);
}

export function getApprovedExpenseTotalsForSession(
  session: { openedAt?: Date | string | null; closedAt?: Date | string | null },
  expenses: Array<{ status?: string | null; source?: string | null; amount?: number | string | null; occurredAt?: Date | string | null }>,
) {
  const openedAt = session.openedAt ? new Date(session.openedAt).getTime() : 0;
  const closedAt = session.closedAt ? new Date(session.closedAt).getTime() : Number.POSITIVE_INFINITY;

  const approvedExpenses = (expenses ?? []).filter((expense) => {
    if (String(expense.status ?? "") !== "APPROVED") return false;
    const occurredAt = expense.occurredAt ? new Date(expense.occurredAt).getTime() : Number.NEGATIVE_INFINITY;
    return occurredAt >= openedAt && occurredAt <= closedAt;
  });

  const cashExpenseTotal = approvedExpenses
    .filter((expense) => (expense.source ?? "CASH") === "CASH")
    .reduce((sum, expense) => sum + toNumber(expense.amount ?? 0), 0);

  const mpesaExpenseTotal = approvedExpenses
    .filter((expense) => (expense.source ?? "CASH") === "MPESA")
    .reduce((sum, expense) => sum + toNumber(expense.amount ?? 0), 0);

  return {
    cashExpenseTotal,
    mpesaExpenseTotal,
  };
}

export function validateRegisterClosingInput(input: {
  actualCash?: number | string | null;
  expectedCash?: number | string | null;
  variance?: number | string | null;
  actualMpesaBalance?: number | string | null;
  expectedMpesa?: number | string | null;
  mpesaVariance?: number | string | null;
  varianceReason?: string | null;
  unresolvedClosureReason?: string | null;
  unresolvedPayments?: number | string | null;
}) {
  const issues: string[] = [];

  const cashVariance = Number(input.variance ?? (Number(input.actualCash ?? 0) - Number(input.expectedCash ?? 0)));
  const mpesaVariance = Number(input.mpesaVariance ?? (Number(input.actualMpesaBalance ?? 0) - Number(input.expectedMpesa ?? 0)));

  if (Math.abs(cashVariance) > 0.0001 || Math.abs(mpesaVariance) > 0.0001) {
    if (!String(input.varianceReason ?? "").trim()) {
      issues.push("A variance explanation is required when the counted cash or M-Pesa balance does not match the expected balance.");
    }
  }

  if (Number(input.unresolvedPayments ?? 0) > 0 && !String(input.unresolvedClosureReason ?? "").trim()) {
    issues.push("An unresolved closure reason is required when there are unresolved M-Pesa payments.");
  }

  return issues;
}

export async function getShopRegisterData(shopId: string, businessId: string) {
  const [business, shop, counters, registers, salespeople, openSessions, recentSessions] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.shop.findUniqueOrThrow({ where: { id: shopId } }),
    db.counter.findMany({ where: { shopId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    db.register.findMany({ where: { shopId, isActive: true }, orderBy: { name: "asc" } }),
    db.salespersonProfile.findMany({ where: { shopId, isActive: true }, orderBy: { name: "asc" } }),
    db.registerSession.findMany({
      where: { shopId, status: "OPEN" },
      include: { register: true, salesperson: true },
      orderBy: { openedAt: "desc" },
    }),
    db.registerSession.findMany({
      where: { shopId },
      include: { register: true, salesperson: true },
      orderBy: { openedAt: "desc" },
      take: 20,
    }),
  ]);

  const openSessionDetails = await Promise.all(openSessions.map((session) => buildSessionViewModel(session, shopId)));
  const recentSessionDetails = await Promise.all(recentSessions.map((session) => buildSessionViewModel(session, shopId)));

  return {
    business,
    shop,
    counters,
    registers,
    salespeople,
    openSessions: openSessionDetails,
    recentSessions: recentSessionDetails,
    paymentChannels: buildEnabledPaymentChannels(shop),
    paymentWarnings: getPaymentChannelWarnings(shop),
  };
}

export async function buildSessionViewModel(session: any, shopId: string) {
  const [sales, payments, registerTransactions, mpesaPayments, approvedExpenses] = await Promise.all([
    db.sale.findMany({ where: { shopId, registerSessionId: session.id, status: { in: ["COMPLETED", "REFUNDED"] } } }),
    db.payment.findMany({ where: { sale: { registerSessionId: session.id } } }),
    db.registerTransaction.findMany({ where: { registerSessionId: session.id } }),
    db.mpesaPayment.findMany({ where: { shopId, shiftId: session.id } }),
    db.expense.findMany({
      where: {
        shopId,
        status: "APPROVED",
        occurredAt: {
          gte: session.openedAt,
          lte: session.closedAt ?? new Date(),
        },
      },
    }),
  ]);

  const cashSalesTotal = calculateCashSalesTotal(sales, payments);
  const approvedExpenseTotals = getApprovedExpenseTotalsForSession(session, approvedExpenses);
  const cashExpenseTotal = approvedExpenseTotals.cashExpenseTotal;
  const cashInTotal = registerTransactions.filter((entry: any) => entry.type === "CASH_IN" || entry.type === "SAFE_TRANSFER_IN" || entry.type === "REGISTER_TRANSFER_IN").reduce((sum: number, entry: any) => sum + toNumber(entry.amount), 0);
  const cashOutTotal = registerTransactions.filter((entry: any) => entry.type === "CASH_OUT" || entry.type === "SAFE_TRANSFER_OUT" || entry.type === "REGISTER_TRANSFER_OUT" || entry.type === "VARIANCE_ADJUSTMENT").reduce((sum: number, entry: any) => sum + toNumber(entry.amount), 0);
  const expectedCash = calculateExpectedCash({
    openingCash: session.openingCash,
    cashSalesTotal,
    cashExpenseTotal,
    cashInTotal,
    cashOutTotal,
  });

  const confirmedMpesaPayments = mpesaPayments.filter((payment: any) => ["SUCCESSFUL", "MATCHED", "RECEIVED"].includes(payment.status));
  const mpesaSalesTotal = confirmedMpesaPayments.reduce((sum: number, payment: any) => sum + fromMinorUnits(toNumber(payment.receivedAmountMinor || payment.expectedAmountMinor)), 0);
  const expectedMpesa = calculateExpectedMpesa({
    openingMpesaBalance: session.openingMpesaBalance,
    mpesaPayments,
    mpesaExpenseTotal: approvedExpenseTotals.mpesaExpenseTotal,
  });

  const unmatchedPayments = mpesaPayments.filter((payment: any) => ["PENDING", "WAITING_FOR_CUSTOMER", "MATCHING", "UNMATCHED", "AMBIGUOUS", "UNDERPAID", "OVERPAID"].includes(payment.status));
  const actualCash = session.actualCash ?? null;
  const variance = actualCash !== null && actualCash !== undefined ? Number(actualCash) - expectedCash : null;

  return {
    ...session,
    cashSalesTotal,
    expectedCash,
    actualCash,
    variance,
    expectedMpesa,
    mpesaSalesTotal,
    unresolvedPayments: unmatchedPayments.length,
    cashLedgerEntries: buildCashLedgerEntries(session, sales, payments, registerTransactions),
    mpesaLedgerEntries: buildMpesaLedgerEntries(session, mpesaPayments),
    paymentWarnings: [] as string[],
  };
}

export function buildCashLedgerEntries(
  session: any,
  sales: any[] = [],
  payments: any[] = [],
  transactions: any[] = [],
) {
  const entries = [] as any[];
  const openingBalance = Number(session.openingCash ?? 0);
  entries.push({
    id: `${session.id}-opening`,
    time: session.openedAt,
    entryType: "Opening float",
    description: "Opening cash float",
    reference: session.localReference ?? session.id,
    moneyIn: openingBalance,
    moneyOut: 0,
    runningBalance: openingBalance,
    user: session.salesperson?.name ?? "Operator",
    status: "Confirmed",
    notes: session.openingNote ?? "",
  });

  const cashSales = payments.filter((payment: any) => payment.method === "CASH" && payment.status === "VERIFIED");
  cashSales.forEach((payment: any) => {
    const sale = sales.find((entry: any) => entry.id === payment.saleId);
    entries.push({
      id: `sale-${payment.saleId}`,
      time: sale?.occurredAt ?? new Date(),
      entryType: "Cash sale",
      description: sale ? `Sale ${sale.receiptNumber}` : "Cash sale",
      reference: sale?.receiptNumber ?? payment.reference ?? payment.id,
      moneyIn: toNumber(sale?.total ?? payment.amount ?? 0),
      moneyOut: 0,
      runningBalance: 0,
      user: sale?.salespersonId ? "Salesperson" : "Operator",
      status: "Confirmed",
      notes: "",
    });
  });

  transactions.filter((entry: any) => ["EXPENSE", "CASH_IN", "CASH_OUT", "SAFE_TRANSFER_IN", "SAFE_TRANSFER_OUT", "REGISTER_TRANSFER_IN", "REGISTER_TRANSFER_OUT", "VARIANCE_ADJUSTMENT"].includes(entry.type)).forEach((entry: any) => {
    entries.push({
      id: entry.id,
      time: entry.createdAt ?? session.openedAt,
      entryType: entry.type,
      description: entry.note ?? entry.type,
      reference: entry.id,
      moneyIn: ["CASH_IN", "SAFE_TRANSFER_IN", "REGISTER_TRANSFER_IN"].includes(entry.type) ? toNumber(entry.amount) : 0,
      moneyOut: ["EXPENSE", "CASH_OUT", "SAFE_TRANSFER_OUT", "REGISTER_TRANSFER_OUT", "VARIANCE_ADJUSTMENT"].includes(entry.type) ? toNumber(entry.amount) : 0,
      runningBalance: 0,
      user: "Operator",
      status: "Confirmed",
      notes: entry.note ?? "",
    });
  });

  if (session.status === "CLOSED") {
    entries.push({
      id: `${session.id}-closing`,
      time: session.closedAt ?? new Date(),
      entryType: "Closing count",
      description: "Session close reconciliation",
      reference: session.localReference ?? session.id,
      moneyIn: 0,
      moneyOut: 0,
      runningBalance: toNumber(session.actualCash ?? session.expectedCash ?? 0),
      user: session.salesperson?.name ?? "Operator",
      status: session.actualCash === session.expectedCash ? "Balanced" : "Variance",
      notes: session.closingNote ?? "",
    });
  }

  let runningBalance = openingBalance;
  return entries.map((entry) => {
    runningBalance += Number(entry.moneyIn ?? 0) - Number(entry.moneyOut ?? 0);
    return { ...entry, runningBalance };
  });
}

export function buildMpesaLedgerEntries(session: any, mpesaPayments: any[] = []) {
  const entries = [] as any[];
  const openingBalance = Number(session.openingMpesaBalance ?? 0);
  if (openingBalance > 0) {
    entries.push({
      id: `${session.id}-opening-mpesa`,
      time: session.openedAt,
      paymentType: "Opening balance",
      saleReference: "",
      internalReference: session.localReference ?? session.id,
      receiptNumber: "",
      merchantRequestId: "",
      checkoutRequestId: "",
      customerPhone: "",
      tillNumber: session.openingMpesaReference ?? "",
      moneyIn: openingBalance,
      moneyOut: 0,
      runningBalance: openingBalance,
      paymentStatus: "Confirmed",
      matchStatus: "Matched",
      cashier: session.salesperson?.name ?? "Operator",
      shop: session.shopId,
      notes: session.openingNote ?? "",
    });
  }

  mpesaPayments.forEach((payment: any) => {
    const amount = fromMinorUnits(toNumber(payment.receivedAmountMinor || payment.expectedAmountMinor));
    const paymentStatus = payment.status;
    const matchStatus = payment.matchStatus ?? "Pending";
    entries.push({
      id: payment.id,
      time: payment.createdAt ?? new Date(),
      paymentType: payment.mode === "STK_PUSH" ? "STK Push" : "Pay to Till",
      saleReference: payment.clientReference ?? payment.internalReference,
      internalReference: payment.internalReference,
      receiptNumber: payment.receiptNumber ?? "",
      merchantRequestId: payment.merchantRequestId ?? "",
      checkoutRequestId: payment.checkoutRequestId ?? "",
      customerPhone: payment.customerPhone ?? "",
      tillNumber: payment.tillNumber ?? "",
      moneyIn: ["SUCCESSFUL", "MATCHED", "RECEIVED"].includes(paymentStatus) ? amount : 0,
      moneyOut: ["REVERSED", "REFUNDED"].includes(paymentStatus) ? amount : 0,
      runningBalance: 0,
      paymentStatus,
      matchStatus,
      cashier: payment.cashierId ? "Operator" : "Operator",
      shop: payment.shopId,
      notes: payment.resultDescription ?? "",
    });
  });

  if (session.status === "CLOSED") {
    entries.push({
      id: `${session.id}-closing-mpesa`,
      time: session.closedAt ?? new Date(),
      paymentType: "Closing balance",
      saleReference: "",
      internalReference: session.localReference ?? session.id,
      receiptNumber: "",
      merchantRequestId: "",
      checkoutRequestId: "",
      customerPhone: "",
      tillNumber: session.closingMpesaReference ?? "",
      moneyIn: 0,
      moneyOut: 0,
      runningBalance: toNumber(session.actualClosingMpesaBalance ?? session.expectedClosingMpesaBalance ?? 0),
      paymentStatus: session.mpesaVarianceStatus ?? "Closed",
      matchStatus: "Matched",
      cashier: session.salesperson?.name ?? "Operator",
      shop: session.shopId,
      notes: session.closingNote ?? "",
    });
  }

  let runningBalance = openingBalance;
  return entries.map((entry) => {
    runningBalance += Number(entry.moneyIn ?? 0) - Number(entry.moneyOut ?? 0);
    return { ...entry, runningBalance };
  });
}

export async function openRegisterSession(shopUser: ShopContext, input: OpenRegisterInput) {
  // Validate counter exists and belongs to this shop
  const counter = await db.counter.findFirst({ where: { id: input.counterId, shopId: shopUser.shopId, status: "ACTIVE" } });
  if (!counter) throw new AppError("Counter was not found or is inactive.");

  // Check for existing OPEN session on THIS COUNTER (not the shop)
  const existing = await db.registerSession.findFirst({ where: { counterId: input.counterId, status: "OPEN" } });
  if (existing) throw new AppError(`Counter ${counter.name} already has an open register session.`);

  const register = await db.register.findFirst({ where: { id: input.registerId, shopId: shopUser.shopId, isActive: true } });
  if (!register) throw new AppError("Register was not found.");

  const idempotencyKey = input.idempotencyKey || `register-open-${register.id}-${counter.id}-${Date.now()}`;
  const duplicate = await db.registerSession.findFirst({ where: { counterId: input.counterId, idempotencyKey } });
  if (duplicate) throw new AppError("This opening request has already been processed.");

  if (!input.salespersonId) {
    throw new AppError("Please select the cashier before opening the register.");
  }

  const salesperson = await db.salespersonProfile.findFirst({
    where: { id: input.salespersonId, shopId: shopUser.shopId, isActive: true },
  });
  if (!salesperson) throw new AppError("Salesperson profile was not found.");

  const biometricVerified = input.biometricAuthToken
    ? await consumeBiometricAuthentication({
        authenticationToken: input.biometricAuthToken,
        salespersonId: salesperson.id,
        shopId: shopUser.shopId,
      })
    : false;

  if (!input.pin && !biometricVerified) {
    throw new AppError("A valid salesperson PIN or verified fingerprint is required to open the register.");
  }

  if (input.pin && !(await argon2.verify(salesperson.pinHash, input.pin))) {
    throw new AppError("The salesperson PIN is incorrect.");
  }

  const salespersonId = salesperson.id;

  const denominationTotal = [
    input.cashDenomination1000 ?? 0,
    input.cashDenomination500 ?? 0,
    input.cashDenomination200 ?? 0,
    input.cashDenomination100 ?? 0,
    input.cashDenomination50 ?? 0,
    input.cashDenomination20 ?? 0,
    input.cashDenomination10 ?? 0,
    input.cashDenomination5 ?? 0,
    input.cashDenomination1 ?? 0,
  ].reduce((sum, value) => sum + Number(value), 0);

  const declaredOpeningCash = Number(input.openingCash ?? 0);
  if (denominationTotal > 0 && declaredOpeningCash > 0 && denominationTotal !== declaredOpeningCash) {
    throw new AppError("The declared opening cash does not match the denomination count. Resolve the mismatch before opening.", "REGISTER_CASH_MISMATCH", 400);
  }

  const openingCash = declarationTotalOrInput(declaredOpeningCash, denominationTotal);

  const session = await db.registerSession.create({
    data: {
      shopId: shopUser.shopId,
      counterId: input.counterId,
      registerId: register.id,
      salespersonId,
      openingCash,
      openingNote: input.openingNote || null,
      openingCashSource: input.openingCashSource || null,
      openingMpesaBalance: input.openingMpesaBalance ?? 0,
      openingMpesaBalanceMethod: input.openingMpesaBalanceMethod || null,
      openingMpesaVerifiedBy: input.openingMpesaVerifiedBy || null,
      openingMpesaVerifiedAt: input.openingMpesaBalanceMethod ? new Date() : null,
      openingMpesaReference: input.openingMpesaReference || null,
      enabledPaymentChannels: parseEnabledPaymentChannels(input.enabledPaymentChannels),
      idempotencyKey,
      openedAt: new Date(),
      status: "OPEN",
    },
  });

  await Promise.all([
    db.registerTransaction.create({ data: { registerSessionId: session.id, type: "OPENING_FLOAT", amount: openingCash, note: input.openingNote || null } }),
    input.openingMpesaBalance && Number(input.openingMpesaBalance) > 0
      ? db.registerTransaction.create({ data: { registerSessionId: session.id, type: "OPENING_BALANCE", amount: Number(input.openingMpesaBalance), note: input.openingMpesaReference || null } })
      : Promise.resolve(null),
  ]);

  await writeAuditLog(db, {
    userId: shopUser.id,
    shopId: shopUser.shopId,
    action: "REGISTER_OPENED",
    entityType: "REGISTER_SESSION",
    entityId: session.id,
    description: `Opened ${counter.name} - ${register.name} with opening cash ${openingCash} and M-Pesa balance ${input.openingMpesaBalance ?? 0}.`,
    metadata: {
      counterId: input.counterId,
      registerId: register.id,
      openingCash,
      openingMpesaBalance: input.openingMpesaBalance ?? 0,
      salespersonId,
    },
  });
  return session;
}

function declarationTotalOrInput(declaredOpeningCash: number, denominationTotal: number) {
  if (denominationTotal > 0) return denominationTotal;
  return declaredOpeningCash;
}

function parseEnabledPaymentChannels(value?: string | null) {
  if (!value) return ["CASH"];
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

export async function closeRegisterSession(shopUser: ShopContext, input: CloseRegisterInput) {
  const session = await db.registerSession.findFirst({
    where: { id: input.sessionId, shopId: shopUser.shopId, status: "OPEN" },
    include: { register: true },
  });
  if (!session) throw new AppError("Open register session was not found.");

  const idempotencyKey = input.idempotencyKey || `register-close-${session.id}-${Date.now()}`;
  const duplicate = await db.registerSession.findFirst({ where: { shopId: shopUser.shopId, idempotencyKey } });
  if (duplicate) throw new AppError("This closure request has already been processed.");

  const [sales, payments, registerTransactions, mpesaPayments, approvedExpenses] = await Promise.all([
    db.sale.findMany({ where: { shopId: shopUser.shopId, registerSessionId: session.id, status: { in: ["COMPLETED", "REFUNDED"] } } }),
    db.payment.findMany({ where: { sale: { registerSessionId: session.id } } }),
    db.registerTransaction.findMany({ where: { registerSessionId: session.id } }),
    db.mpesaPayment.findMany({ where: { shopId: shopUser.shopId, shiftId: session.id } }),
    db.expense.findMany({
      where: {
        shopId: shopUser.shopId,
        status: "APPROVED",
        occurredAt: {
          gte: session.openedAt,
          lte: new Date(),
        },
      },
    }),
  ]);

  const cashSalesTotal = calculateCashSalesTotal(sales, payments);
  const approvedExpenseTotals = getApprovedExpenseTotalsForSession(session, approvedExpenses);
  const cashExpenseTotal = approvedExpenseTotals.cashExpenseTotal;
  const mpesaExpenseTotal = approvedExpenseTotals.mpesaExpenseTotal;
  const cashInTotal = registerTransactions.filter((entry: any) => entry.type === "CASH_IN" || entry.type === "SAFE_TRANSFER_IN" || entry.type === "REGISTER_TRANSFER_IN").reduce((sum: number, entry: any) => sum + toNumber(entry.amount), 0);
  const cashOutTotal = registerTransactions.filter((entry: any) => entry.type === "CASH_OUT" || entry.type === "SAFE_TRANSFER_OUT" || entry.type === "REGISTER_TRANSFER_OUT" || entry.type === "VARIANCE_ADJUSTMENT").reduce((sum: number, entry: any) => sum + toNumber(entry.amount), 0);
  const expectedCash = calculateExpectedCash({
    openingCash: session.openingCash,
    cashSalesTotal,
    cashExpenseTotal,
    cashInTotal,
    cashOutTotal,
  });

  const confirmedMpesaPayments = mpesaPayments.filter((payment: any) => ["SUCCESSFUL", "MATCHED", "RECEIVED"].includes(payment.status));
  const mpesaSalesTotal = confirmedMpesaPayments.reduce((sum: number, payment: any) => sum + fromMinorUnits(toNumber(payment.receivedAmountMinor || payment.expectedAmountMinor)), 0);
  const expectedMpesa = calculateExpectedMpesa({
    openingMpesaBalance: session.openingMpesaBalance,
    mpesaPayments,
    mpesaExpenseTotal,
  });
  const actualMpesaBalance = Number(input.actualMpesaBalance ?? 0);
  const mpesaVariance = actualMpesaBalance - expectedMpesa;
  const unresolvedPayments = mpesaPayments.filter((payment: any) => ["PENDING", "WAITING_FOR_CUSTOMER", "MATCHING", "UNMATCHED", "AMBIGUOUS", "UNDERPAID", "OVERPAID"].includes(payment.status)).length;
  const closedWithUnresolvedPayments = unresolvedPayments > 0;
  const variance = Number(input.actualCash ?? 0) - expectedCash;
  const validationErrors = validateRegisterClosingInput({
    actualCash: input.actualCash,
    expectedCash,
    variance,
    actualMpesaBalance: actualMpesaBalance,
    expectedMpesa,
    mpesaVariance,
    varianceReason: input.varianceReason,
    unresolvedClosureReason: input.unresolvedClosureReason,
    unresolvedPayments,
  });

  if (validationErrors.length) {
    throw new AppError(validationErrors.join(" "), "REGISTER_CLOSURE_VALIDATION", 400);
  }

  const closed = await db.$transaction(async (tx) => {
    const updated = await tx.registerSession.update({
      where: { id: session.id },
      data: {
        status: "CLOSED",
        expectedCash,
        actualCash: input.actualCash,
        variance,
        expectedClosingMpesaBalance: expectedMpesa,
        actualClosingMpesaBalance: actualMpesaBalance,
        mpesaVariance,
        mpesaVarianceStatus: mpesaVariance === 0 ? "Balanced" : mpesaVariance > 0 ? "Over" : "Short",
        mpesaVarianceReason: input.varianceReason || null,
        closingNote: input.closingNote || null,
        closingMpesaBalanceMethod: input.closingMpesaBalanceMethod || null,
        closingMpesaVerifiedBy: input.closingMpesaVerifiedBy || null,
        closingMpesaReference: input.closingMpesaReference || null,
        unresolvedPaymentCount: unresolvedPayments,
        closedWithUnresolvedPayments,
        unresolvedClosureReason: input.unresolvedClosureReason || null,
        approvedBy: input.approvedBy || null,
        idempotencyKey,
        closedAt: new Date(),
      },
    });

    await tx.registerTransaction.create({ data: { registerSessionId: session.id, type: "CLOSING_COUNT", amount: input.actualCash, note: input.closingNote || null } });
    if (variance !== 0) {
      await tx.registerTransaction.create({ data: { registerSessionId: session.id, type: "VARIANCE_ADJUSTMENT", amount: variance, note: input.varianceReason || null } });
      const admin = await tx.user.findFirst({ where: { businessId: shopUser.businessId, role: "ADMIN", status: "ACTIVE" } });
      if (admin) {
        await tx.notification.create({
          data: {
            userId: admin.id,
            shopId: shopUser.shopId,
            type: "REGISTER_DISCREPANCY",
            priority: Math.abs(variance) > 1000 ? "HIGH" : "NORMAL",
            title: "Register discrepancy",
            message: `${session.register.name} closed with a variance of ${variance.toFixed(2)}.`,
            actionUrl: "/admin/registers",
          },
        });
      }
    }

    await writeAuditLog(tx, {
      userId: shopUser.id,
      shopId: shopUser.shopId,
      action: closedWithUnresolvedPayments ? "REGISTER_CLOSED_WITH_UNRESOLVED_PAYMENTS" : "REGISTER_CLOSED",
      entityType: "REGISTER_SESSION",
      entityId: session.id,
      description: `Closed ${session.register.name} with cash variance ${variance.toFixed(2)} and M-Pesa variance ${mpesaVariance.toFixed(2)}.`,
      metadata: { expectedCash, actualCash: input.actualCash, variance, expectedMpesa, actualMpesaBalance, mpesaVariance, unresolvedPayments },
    });
    return updated;
  });
  return closed;
}
