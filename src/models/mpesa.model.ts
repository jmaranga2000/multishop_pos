import { defineModel, index, now } from "./model-definition";
import type {
  MpesaCallbackEventDocument,
  MpesaPaymentDocument,
} from "./model.types";

export const MpesaPaymentModel = defineModel<MpesaPaymentDocument>({
  collection: "mpesaPayments",
  required: ["shopId", "saleId", "mode", "status", "expectedAmountMinor", "idempotencyKey", "internalReference", "expiryAt"],
  defaults: {
    status: "PENDING",
    expectedAmountMinor: 0,
    receivedAmountMinor: 0,
    matchStatus: "PENDING",
    createdAt: now,
    updatedAt: now,
  },
  enums: {
    mode: ["STK_PUSH", "PAY_TO_TILL"],
    status: ["PENDING", "WAITING_FOR_CUSTOMER", "SENDING_REQUEST", "REQUEST_SENT", "RECEIVED", "MATCHING", "MATCHED", "SUCCESSFUL", "FAILED", "CANCELLED", "TIMED_OUT", "UNDERPAID", "OVERPAID", "AMBIGUOUS", "UNMATCHED", "REVERSED", "CONFIRMATION_DELAYED", "CHECKING_PAYMENT_STATUS", "READY"],
    matchStatus: ["PENDING", "MATCHED", "AMBIGUOUS", "UNMATCHED", "REVERSED"],
  },
  indexes: [
    index({ shopId: 1, clientReference: 1 }),
    index({ shopId: 1, status: 1, expiresAt: 1 }),
    index({ transactionId: 1 }, { unique: true, sparse: true }),
    index({ internalReference: 1 }, { unique: true }),
    index({ shopId: 1, idempotencyKey: 1 }, { unique: true }),
  ],
});

export const MpesaCallbackEventModel = defineModel<MpesaCallbackEventDocument>({
  collection: "mpesaCallbackEvents",
  required: ["shopId", "transactionId", "processingStatus"],
  defaults: {
    processingStatus: "PENDING",
    createdAt: now,
    processedAt: null,
  },
  enums: {
    processingStatus: ["PENDING", "PROCESSED", "DUPLICATE", "FAILED"],
  },
  indexes: [
    index({ transactionId: 1 }, { unique: true }),
    index({ shopId: 1, processedAt: 1 }),
  ],
});

export const mpesaModels = {
  mpesaPayment: MpesaPaymentModel,
  mpesaCallbackEvent: MpesaCallbackEventModel,
};
