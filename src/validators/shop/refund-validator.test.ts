import test from "node:test";
import assert from "node:assert/strict";
import { createRefundRequestSchema } from "./refund-validator";

test("accepts full-sale refund requests with manager approval", () => {
  const result = createRefundRequestSchema.safeParse({
    saleId: "sale-1",
    requestType: "FULL_SALE",
    refundMethod: "CASH",
    restockReturnedProducts: true,
    markItemsAsDamaged: false,
    requestManagerApproval: true,
    reason: "Customer changed mind",
  });

  assert.equal(result.success, true);
});

test("requires selected item ids for selected-product returns", () => {
  const result = createRefundRequestSchema.safeParse({
    saleId: "sale-1",
    requestType: "SELECTED_PRODUCTS",
    refundMethod: "MPESA",
    selectedItemIds: [],
    reason: "Damaged item",
  });

  assert.equal(result.success, false);
});
