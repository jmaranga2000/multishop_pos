import test from "node:test";
import assert from "node:assert/strict";
import { createShopSchema } from "./shop-validator";
import { createSalespersonSchema } from "./salesperson-validator";

test("createShopSchema normalizes counter names from a textarea", () => {
  const parsed = createShopSchema.parse({
    name: "Kisii Shop",
    code: "",
    email: "shop@example.com",
    password: "Secret123!",
    counters: "Main counter\nCounter 1, Counter 3",
  });

  assert.deepEqual(parsed.counters, ["Main counter", "Counter 1", "Counter 3"]);
});

test("createSalespersonSchema accepts an optional register assignment", () => {
  const parsed = createSalespersonSchema.parse({
    shopId: "shop-1",
    name: "Jane",
    code: "JANE01",
    pin: "1234",
    registerId: "register-1",
  });

  assert.equal(parsed.registerId, "register-1");
});
