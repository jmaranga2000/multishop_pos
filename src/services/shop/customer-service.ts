import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { writeAuditLog } from "@/services/shared/audit-service";
import type { CreateCustomerInput, CreateLedgerEntryInput, ReceiveCustomerPaymentInput, CreateAdjustmentInput } from "@/validators/shop/customer-validator";

type ShopUser = { id: string; shopId: string; businessId: string; role: string };

export async function createCustomer(user: ShopUser, input: CreateCustomerInput) {
  return db.$transaction(async (tx) => {
    const customer = await tx.customer.create({ data: {
      shopId: user.shopId,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      creditLimit: input.creditLimitMinor ?? 0,
      cachedOutstandingMinor: 0,
    } });

    await writeAuditLog(tx, { action: "CUSTOMER_CREATED", userId: user.id, shopId: user.shopId, description: `Customer ${customer.id} created`, metadata: { customerId: customer.id } });
    return customer;
  });
}

export async function getCustomer(user: ShopUser, customerId: string) {
  const customer = await db.customer.findFirst({ where: { id: customerId, shopId: user.shopId } });
  if (!customer) throw new AppError("Customer not found", "NOT_FOUND", 404);
  return customer;
}

export async function listCustomers(user: ShopUser, query: { search?: string } = {}) {
  const where: any = { shopId: user.shopId };
  if (query.search) where.name = { contains: query.search };
  return db.customer.findMany({ where, orderBy: { name: "asc" }, take: 200 });
}

export async function createLedgerEntry(user: ShopUser, customerId: string, input: CreateLedgerEntryInput) {
  return db.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: customerId, shopId: user.shopId } });
    if (!customer) throw new AppError("Customer not found", "NOT_FOUND", 404);

    const previousBalance = Number(customer.cachedOutstandingMinor ?? 0);
    const newBalance = previousBalance + Number(input.debitMinor ?? 0) - Number(input.creditMinor ?? 0);

    const ledgerEntry = await tx.ledgerEntry.create({ data: {
      transactionId: input.transactionId,
      customerId,
      shopId: user.shopId,
      type: input.type,
      occurredAt: input.occurredAt,
      reference: input.reference ?? null,
      description: input.description ?? null,
      debitMinor: input.debitMinor,
      creditMinor: input.creditMinor,
      runningBalanceMinor: newBalance,
      userId: user.id,
      saleId: input.saleId ?? null,
      paymentId: input.paymentId ?? null,
      syncStatus: "PENDING",
    } });

    await tx.customer.update({ where: { id: customerId }, data: { cachedOutstandingMinor: newBalance, lastTransactionAt: new Date() } });

    await writeAuditLog(tx, { action: "CUSTOMER_LEDGER_ENTRY", userId: user.id, shopId: user.shopId, description: `Ledger entry ${ledgerEntry.id} for ${customerId}`, metadata: { customerId, entryId: ledgerEntry.id, transactionId: input.transactionId } });
    return ledgerEntry;
  });
}

export async function receiveCustomerPayment(user: ShopUser, customerId: string, input: ReceiveCustomerPaymentInput) {
  return db.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: customerId, shopId: user.shopId } });
    if (!customer) throw new AppError("Customer not found", "NOT_FOUND", 404);

    // Create ledger entry: credit the customer's account (reduce outstanding)
    const transactionId = `payment-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    
    // Idempotency check: ensure we don't create duplicate payment entries
    const existingEntry = await tx.ledgerEntry.findFirst({
      where: { transactionId, customerId, shopId: user.shopId },
    });

    if (existingEntry) {
      // Payment already recorded, return existing entry
      return existingEntry;
    }

    const debit = 0;
    const credit = Number(input.amountMinor);
    const previous = Number(customer.cachedOutstandingMinor ?? 0);
    const running = previous - credit;

    const ledgerEntry = await tx.ledgerEntry.create({ data: {
      transactionId,
      customerId,
      shopId: user.shopId,
      type: "CUSTOMER_PAYMENT",
      occurredAt: new Date(),
      reference: input.reference ?? null,
      description: input.note ?? null,
      debitMinor: debit,
      creditMinor: credit,
      runningBalanceMinor: running,
      userId: user.id,
      paymentId: null,
      syncStatus: "PENDING",
    } });

    await tx.customer.update({ where: { id: customerId }, data: { cachedOutstandingMinor: running, lastTransactionAt: new Date() } });

    // Register reconciliation: if registerSessionId provided, add registerTransaction
    if (input.registerSessionId) {
      await tx.registerTransaction.create({ data: { registerSessionId: input.registerSessionId, type: "CASH_IN", amount: input.method === "CASH" ? Number(input.amountMinor) / 100 : 0, note: `Customer payment ${transactionId}` } });
    }

    await writeAuditLog(tx, { action: "CUSTOMER_PAYMENT_RECEIVED", userId: user.id, shopId: user.shopId, description: `Payment received ${ledgerEntry.id}`, metadata: { customerId, ledgerEntryId: ledgerEntry.id, amountMinor: input.amountMinor } });
    return ledgerEntry;
  });
}

export async function createCustomerAdjustment(user: ShopUser, customerId: string, input: CreateAdjustmentInput) {
  return db.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: customerId, shopId: user.shopId } });
    if (!customer) throw new AppError("Customer not found", "NOT_FOUND", 404);

    const transactionId = `adjustment-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const previous = Number(customer.cachedOutstandingMinor ?? 0);
    const debitMinor = input.type === "DEBIT_ADJUSTMENT" ? input.amountMinor : 0;
    const creditMinor = input.type === "CREDIT_ADJUSTMENT" ? input.amountMinor : 0;
    const newBalance = previous + debitMinor - creditMinor;

    const ledgerEntry = await tx.ledgerEntry.create({ data: {
      transactionId,
      customerId,
      shopId: user.shopId,
      type: input.type,
      occurredAt: new Date(),
      reference: input.reference ?? null,
      description: input.reason,
      debitMinor,
      creditMinor,
      runningBalanceMinor: newBalance,
      userId: user.id,
      syncStatus: "PENDING",
    } });

    await tx.customer.update({
      where: { id: customerId },
      data: { cachedOutstandingMinor: newBalance, lastTransactionAt: new Date() },
    });

    await writeAuditLog(tx, {
      action: `CUSTOMER_${input.type}`,
      userId: user.id,
      shopId: user.shopId,
      description: `${input.type} for customer ${customerId}: ${input.reason}`,
      metadata: {
        customerId,
        adjustmentType: input.type,
        amountMinor: input.amountMinor,
        reason: input.reason,
        ledgerEntryId: ledgerEntry.id,
      },
    });

    return ledgerEntry;
  });
}
