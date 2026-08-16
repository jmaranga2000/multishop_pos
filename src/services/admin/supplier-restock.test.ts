import assert from "node:assert/strict";
import test from "node:test";
import { calculateSupplierRestockQuantity } from "./supplier-service";

test("supplier restock quantity honours a target quantity when one is configured", () => {
  assert.equal(calculateSupplierRestockQuantity(7, 24, 10, 20, "LOW_STOCK"), 17);
});

test("supplier restock quantity uses the configured reorder quantity when stock is below threshold", () => {
  assert.equal(calculateSupplierRestockQuantity(4, 0, 10, 20, "CRITICAL"), 20);
  assert.equal(calculateSupplierRestockQuantity(0, 0, 10, 20, "OUT_OF_STOCK"), 20);
});

test("supplier restock quantity excludes healthy stock when it has no target", () => {
  assert.equal(calculateSupplierRestockQuantity(15, 0, 10, 20, "IN_STOCK"), 0);
});