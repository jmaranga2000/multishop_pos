import test from "node:test";
import assert from "node:assert/strict";
import { getStockStatusMeta } from "./stock-status";

test("maps stock statuses to detail page metadata", () => {
  assert.deepEqual(getStockStatusMeta("LOW_STOCK"), {
    label: "Low stock",
    slug: "low-stock",
    tone: "amber",
    description: "Products that are approaching their reorder threshold.",
  });

  assert.deepEqual(getStockStatusMeta("CRITICAL"), {
    label: "Critical stock",
    slug: "critical-stock",
    tone: "red",
    description: "Products that require immediate restocking attention.",
  });

  assert.deepEqual(getStockStatusMeta("OUT_OF_STOCK"), {
    label: "Out of stock",
    slug: "out-of-stock",
    tone: "slate",
    description: "Products that are currently unavailable for sale.",
  });

  assert.deepEqual(getStockStatusMeta("IN_STOCK"), {
    label: "Healthy stock",
    slug: "healthy-stock",
    tone: "emerald",
    description: "Products that are within a healthy inventory range.",
  });
});
