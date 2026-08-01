import test from "node:test";
import assert from "node:assert/strict";
import { describeSaleLifecycleMessage } from "./sale-status";

test("describes pending local sales clearly", () => {
  assert.equal(describeSaleLifecycleMessage("PENDING_SYNC", false), "Stored locally • pending sync");
  assert.equal(describeSaleLifecycleMessage("PENDING_SYNC", true), "Submitted for synchronization");
});

test("describes synced sales clearly", () => {
  assert.equal(describeSaleLifecycleMessage("SYNCED", true), "Synced successfully");
  assert.equal(describeSaleLifecycleMessage("CONFLICT", true), "Sync conflict • review required");
});
