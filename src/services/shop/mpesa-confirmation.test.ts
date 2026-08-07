import test from "node:test";
import assert from "node:assert/strict";
import { summarizeRecentPayers } from "./mpesa-confirmation";

test("summarizes recent payer names without duplicates", () => {
  const result = summarizeRecentPayers([
    { customerName: "Jane", customerPhone: "0712345678", transactionAmount: "125.00", createdAt: new Date(Date.now() - 10_000) },
    { customerName: "Jane", customerPhone: "0712345678", transactionAmount: "125.00", createdAt: new Date(Date.now() - 5_000) },
    { customerName: "John", customerPhone: "0712345679", transactionAmount: "125.00", createdAt: new Date(Date.now() - 2_000) },
  ], 12500);

  assert.deepEqual(result, [
    { name: "Jane", phone: "0712345678", amountMinor: 12500 },
    { name: "John", phone: "0712345679", amountMinor: 12500 },
  ]);
});
