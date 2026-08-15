import test from "node:test";
import assert from "node:assert/strict";
import { getSyncQueueStatuses, detectMixedUnitSaleConflict } from "./conflicts";
import { hasPriceMismatchBetweenMinorUnits } from "./price";

test("retry-only mode targets failed and conflict queue rows", () => {
  const statuses = getSyncQueueStatuses({ retryFailedOnly: true });
  assert.deepEqual(statuses, ["FAILED", "CONFLICT"]);
});

test("default sync mode targets pending, failed and conflict rows", () => {
  const statuses = getSyncQueueStatuses();
  assert.deepEqual(statuses, ["PENDING_SYNC", "FAILED", "CONFLICT"]);
});

test("tiny currency rounding differences do not create false sync conflicts", () => {
  assert.equal(hasPriceMismatchBetweenMinorUnits(15000, 14999), false);
  assert.equal(hasPriceMismatchBetweenMinorUnits(15000, 14800), true);
});

test("mixed-unit sales for the same product are flagged as a sync conflict", () => {
  assert.equal(detectMixedUnitSaleConflict([
    { productId: "egg-1", unitId: "tray" },
    { productId: "egg-1", unitId: "piece" },
  ]), true);

  assert.equal(detectMixedUnitSaleConflict([
    { productId: "egg-1", unitId: "tray" },
    { productId: "egg-2", unitId: "piece" },
  ]), false);
});
