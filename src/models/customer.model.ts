import { defineModel, index, now } from "./model-definition";
import type { CustomerDocument, CustomerLedgerEntryDocument } from "./model.types";

export const CustomerModel = defineModel<CustomerDocument>({
  collection: "customers",
  required: ["shopId", "name", "creditLimit"],
  defaults: { creditLimit: 0, cachedOutstandingMinor: 0, status: "ACTIVE" },
  indexes: [index({ shopId: 1, name: 1 }), index({ shopId: 1, phone: 1 })],
});

export const CustomerLedgerModel = defineModel<CustomerLedgerEntryDocument>({
  collection: "customerLedgerEntries",
  required: ["transactionId", "customerId", "shopId", "type", "occurredAt", "debitMinor", "creditMinor", "runningBalanceMinor"],
  defaults: { syncStatus: "PENDING", createdAt: now },
  enums: { type: ["CREDIT_SALE", "CUSTOMER_PAYMENT", "CUSTOMER_REFUND", "PRODUCT_RETURN", "DEBIT_ADJUSTMENT", "CREDIT_ADJUSTMENT", "OPENING_BALANCE", "REVERSAL"] },
  indexes: [
    index({ customerId: 1, occurredAt: -1 }),
    index({ shopId: 1, occurredAt: -1 }),
    index({ transactionId: 1 }, { unique: true, partialFilterExpression: { transactionId: { $type: "string" } } }),
  ],
});

export const customerModels = { customer: CustomerModel, ledgerEntry: CustomerLedgerModel };
