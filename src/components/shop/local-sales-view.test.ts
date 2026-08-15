import test from "node:test";
import assert from "node:assert/strict";
import { summarizeProductLabels } from "./local-sales-view";

test("summarizes product names for a sale", () => {
  assert.equal(
    summarizeProductLabels([
      { productName: "Cabbage" },
      { productName: "Cabbage" },
      { productName: "Onion" },
    ]),
    "Cabbage, Onion",
  );

  assert.equal(summarizeProductLabels([]), "—");
});
