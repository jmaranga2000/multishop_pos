import test from "node:test";
import assert from "node:assert/strict";
import { createShopSchema } from "./shop-validator";
import { createSalespersonSchema } from "./salesperson-validator";

test("createShopSchema accepts shop details without counter configuration", () => {
  const parsed = createShopSchema.parse({
    name: "Kisii Shop",
    code: "",
    email: "shop@example.com",
    password: "Secret123!",
  });

  assert.equal(parsed.name, "Kisii Shop");
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
