import assert from "node:assert/strict";
import test from "node:test";
import { buildEnabledPaymentChannels } from "./register-service";

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
