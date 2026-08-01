import test from "node:test";
import assert from "node:assert/strict";
import { getSyncQueueStatuses, hasPriceMismatchBetweenMinorUnits } from "./sync";

test("retry-only mode targets failed and conflict queue rows", () => {
  const statuses = getSyncQueueStatuses({ retryFailedOnly: true });
  assert.deepEqual(statuses, ["FAILED", "CONFLICT"]);
});

test("default sync mode targets pending and failed rows", () => {
  const statuses = getSyncQueueStatuses();
  assert.deepEqual(statuses, ["PENDING_SYNC", "FAILED"]);
});

test("tiny currency rounding differences do not create false sync conflicts", () => {
  assert.equal(hasPriceMismatchBetweenMinorUnits(15000, 14999), false);
  assert.equal(hasPriceMismatchBetweenMinorUnits(15000, 14800), true);
});
