import test from "node:test";
import assert from "node:assert/strict";
import { getSyncQueueStatuses } from "./sync";

test("retry-only mode targets failed and conflict queue rows", () => {
  const statuses = getSyncQueueStatuses({ retryFailedOnly: true });
  assert.deepEqual(statuses, ["FAILED", "CONFLICT"]);
});

test("default sync mode targets pending and failed rows", () => {
  const statuses = getSyncQueueStatuses();
  assert.deepEqual(statuses, ["PENDING_SYNC", "FAILED"]);
});
