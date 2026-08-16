import assert from "node:assert/strict";
import test from "node:test";
import { calculateVatTotals } from "./tax-service";

test("calculates standard VAT from VAT-exclusive prices using integer minor units", () => {
  const totals = calculateVatTotals([
    { productId: "eggs", quantity: 2, unitPriceMinor: 45000, taxTreatment: "STANDARD", vatRate: 16 },
  ], "VAT_EXCLUSIVE");

  assert.equal(totals.netMinor, 90000);
  assert.equal(totals.vatMinor, 14400);
  assert.equal(totals.grossMinor, 104400);
  assert.equal(totals.taxableMinor, 90000);
});

test("extracts VAT from VAT-inclusive prices without double charging", () => {
  const totals = calculateVatTotals([
    { productId: "eggs", quantity: 1, unitPriceMinor: 11600, taxTreatment: "STANDARD", vatRate: 16 },
  ], "VAT_INCLUSIVE");

  assert.equal(totals.netMinor, 10000);
  assert.equal(totals.vatMinor, 1600);
  assert.equal(totals.grossMinor, 11600);
});

test("keeps zero-rated and exempt lines out of VAT while preserving gross total", () => {
  const totals = calculateVatTotals([
    { productId: "standard", quantity: 1, unitPriceMinor: 10000, taxTreatment: "STANDARD", vatRate: 16 },
    { productId: "zero", quantity: 1, unitPriceMinor: 5000, taxTreatment: "ZERO_RATED", vatRate: 0 },
    { productId: "exempt", quantity: 1, unitPriceMinor: 3000, taxTreatment: "EXEMPT", vatRate: 0 },
  ], "VAT_EXCLUSIVE");

  assert.equal(totals.taxableMinor, 10000);
  assert.equal(totals.vatMinor, 1600);
  assert.equal(totals.grossMinor, 19600);
  assert.equal(totals.taxTreatment, "MIXED");
});