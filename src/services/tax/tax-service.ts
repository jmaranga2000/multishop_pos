import type { PriceTaxMode, ProductTaxTreatment } from "@/models/model.types";

const RATE_SCALE = 10_000;

export type TaxCalculationLine = {
  productId: string;
  quantity: number;
  unitPriceMinor: number;
  taxTreatment: ProductTaxTreatment;
  vatRate: number;
};

export type CalculatedTaxLine = TaxCalculationLine & {
  netMinor: number;
  vatMinor: number;
  grossMinor: number;
};

export type CalculatedTaxTotals = {
  netMinor: number;
  taxableMinor: number;
  vatMinor: number;
  grossMinor: number;
  taxTreatment: "STANDARD" | "ZERO_RATED" | "EXEMPT" | "MIXED" | "NOT_APPLICABLE";
  lines: CalculatedTaxLine[];
};

function rateToBasisPoints(rate: number) {
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error("VAT rate must be between 0 and 100.");
  return Math.round(rate * 100);
}

function roundDivision(numerator: number, denominator: number) {
  if (!Number.isSafeInteger(numerator) || denominator <= 0) throw new Error("Tax calculation exceeds the supported monetary range.");
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

export function calculateVatTotals(
  lines: TaxCalculationLine[],
  priceTaxMode: PriceTaxMode,
): CalculatedTaxTotals {
  const calculated = lines.map((line) => {
    if (!Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.unitPriceMinor) || line.unitPriceMinor < 0) {
      throw new Error("Invalid line quantity or unit price.");
    }
    const amountMinor = Math.round(line.quantity * line.unitPriceMinor);
    const taxable = line.taxTreatment === "STANDARD";
    const rateBasisPoints = taxable ? rateToBasisPoints(line.vatRate) : 0;
    const vatMinor = rateBasisPoints === 0
      ? 0
      : priceTaxMode === "VAT_INCLUSIVE"
        ? roundDivision(amountMinor * rateBasisPoints, RATE_SCALE + rateBasisPoints)
        : roundDivision(amountMinor * rateBasisPoints, RATE_SCALE);
    const netMinor = priceTaxMode === "VAT_INCLUSIVE" ? amountMinor - vatMinor : amountMinor;
    const grossMinor = priceTaxMode === "VAT_INCLUSIVE" ? amountMinor : amountMinor + vatMinor;
    return { ...line, netMinor, vatMinor, grossMinor };
  });
  const treatments = new Set(calculated.map((line) => line.taxTreatment));
  return {
    netMinor: calculated.reduce((sum, line) => sum + line.netMinor, 0),
    taxableMinor: calculated.filter((line) => line.taxTreatment === "STANDARD").reduce((sum, line) => sum + line.netMinor, 0),
    vatMinor: calculated.reduce((sum, line) => sum + line.vatMinor, 0),
    grossMinor: calculated.reduce((sum, line) => sum + line.grossMinor, 0),
    taxTreatment: treatments.size === 0 ? "NOT_APPLICABLE" : treatments.size === 1 ? [...treatments][0] : "MIXED",
    lines: calculated,
  };
}