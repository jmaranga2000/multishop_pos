import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEnabledPaymentChannels,
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
