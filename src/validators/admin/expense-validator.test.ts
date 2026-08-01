import test from "node:test";
import assert from "node:assert/strict";
import { createExpenseCategorySchema } from "./expense-validator";

test("expense category names must be at least two characters", () => {
  assert.throws(() => {
    createExpenseCategorySchema.parse({ name: "A" });
  });
});

test("expense category names are trimmed before saving", () => {
  const parsed = createExpenseCategorySchema.parse({ name: "  Office Supplies  " });
  assert.equal(parsed.name, "Office Supplies");
});
