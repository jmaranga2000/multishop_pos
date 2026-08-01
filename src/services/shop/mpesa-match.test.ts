import test from "node:test";
import assert from "node:assert/strict";
import { evaluateMpesaPaymentMatch } from "./mpesa-match";

test("matches a single pending payment when amount and phone line up", () => {
  const decision = evaluateMpesaPaymentMatch({
    incomingAmountMinor: 12500,
    customerPhone: "0712345678",
    tillNumber: "123456",
    expectedAmountMinor: 12500,
    paymentPhone: "0712345678",
    paymentTillNumber: "123456",
  });

  assert.equal(decision.kind, "match");
});

test("flags ambiguous matches when multiple payments are equally plausible", () => {
  const decision = evaluateMpesaPaymentMatch({
    incomingAmountMinor: 12500,
    customerPhone: "0712345678",
    tillNumber: "123456",
    expectedAmountMinor: 12500,
    paymentPhone: "0712345678",
    paymentTillNumber: "123456",
    hasOtherCandidate: true,
  });

  assert.equal(decision.kind, "ambiguous");
});

test("flags mismatch when amount differs materially", () => {
  const decision = evaluateMpesaPaymentMatch({
    incomingAmountMinor: 12000,
    customerPhone: "0712345678",
    tillNumber: "123456",
    expectedAmountMinor: 12500,
    paymentPhone: "0712345678",
    paymentTillNumber: "123456",
  });

  assert.equal(decision.kind, "mismatch");
  assert.equal(decision.reason, "amount-mismatch");
});
