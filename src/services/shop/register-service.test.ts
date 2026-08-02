import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEnabledPaymentChannels,
  calculateCashSalesTotal,
  calculateExpectedCash,
  calculateExpectedMpesa,
  validateRegisterClosingInput,
} from "./register-service";

test("buildEnabledPaymentChannels keeps only enabled channels", () => {
  const channels = buildEnabledPaymentChannels({
    mpesaEnabled: true,
    mpesaStkEnabled: true,
    mpesaPayToTillEnabled: false,
  }, ["CASH", "MPESA_STK_PUSH", "MPESA_PAY_TO_TILL"]);

  assert.deepEqual(channels, ["CASH", "MPESA_STK_PUSH", "MPESA_PAY_TO_TILL"]);
});

test("buildEnabledPaymentChannels falls back to cash when no mpesa services are enabled", () => {
  const channels = buildEnabledPaymentChannels({
    mpesaEnabled: false,
    mpesaStkEnabled: false,
    mpesaPayToTillEnabled: false,
  }, []);

  assert.deepEqual(channels, ["CASH"]);
});

test("calculateExpectedCash totals opening float, sales and adjustments", () => {
  const expected = calculateExpectedCash({
    openingCash: 200,
    cashSalesTotal: 950,
    cashExpenseTotal: 50,
    cashInTotal: 120,
    cashOutTotal: 80,
  });

  assert.equal(expected, 1140);
});

test("calculateCashSalesTotal uses each sale total for verified cash payments instead of the tendered amount", () => {
  const expected = calculateCashSalesTotal([
    { id: "sale-1", total: 120, status: "COMPLETED" },
    { id: "sale-2", total: 160, status: "COMPLETED" },
  ] as any[], [
    { saleId: "sale-1", method: "CASH", status: "VERIFIED", amount: 150 },
    { saleId: "sale-2", method: "CASH", status: "VERIFIED", amount: 200 },
  ] as any[]);

  assert.equal(expected, 280);
});

test("calculateExpectedMpesa only counts confirmed payments and ignores failed ones", () => {
  const expected = calculateExpectedMpesa({
    openingMpesaBalance: 40,
    mpesaPayments: [
      { status: "SUCCESSFUL", receivedAmountMinor: 15000 },
      { status: "FAILED", receivedAmountMinor: 5000 },
      { status: "MATCHED", receivedAmountMinor: 22000 },
      { status: "CANCELLED", receivedAmountMinor: 12000 },
    ],
  });

  assert.equal(expected, 40 + 150 + 220);
});

test("validateRegisterClosingInput requires a variance explanation when the counts do not match", () => {
  const result = validateRegisterClosingInput({
    actualCash: 550,
    expectedCash: 500,
    variance: 50,
    actualMpesaBalance: 0,
    expectedMpesa: 0,
    mpesaVariance: 0,
    varianceReason: "",
    unresolvedClosureReason: "",
    unresolvedPayments: 0,
  });

  assert.equal(result.length, 1);
  assert.match(result[0], /variance explanation/i);
});
