export type MpesaMatchDecision =
  | { kind: "match"; confidence: number; reason: "exact" }
  | { kind: "ambiguous"; confidence: number; reason: "multiple-candidates" }
  | { kind: "mismatch"; confidence: number; reason: "amount-mismatch" | "phone-mismatch" | "till-mismatch" | "missing-context" };

type MatchInput = {
  incomingAmountMinor: number;
  customerPhone?: string | null;
  tillNumber?: string | null;
  expectedAmountMinor: number;
  paymentPhone?: string | null;
  paymentTillNumber?: string | null;
  hasOtherCandidate?: boolean;
};

function normalizePhone(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "").replace(/^254/, "0");
  return digits.length === 10 ? digits : null;
}

export function evaluateMpesaPaymentMatch(input: MatchInput): MpesaMatchDecision {
  const normalizedIncomingPhone = normalizePhone(input.customerPhone);
  const normalizedPaymentPhone = normalizePhone(input.paymentPhone);
  const incomingAmount = Number.isFinite(input.incomingAmountMinor) ? input.incomingAmountMinor : 0;
  const expectedAmount = Number.isFinite(input.expectedAmountMinor) ? input.expectedAmountMinor : 0;

  if (!input.tillNumber && !normalizedIncomingPhone && !normalizedPaymentPhone) {
    return { kind: "mismatch", confidence: 0, reason: "missing-context" };
  }

  const amountDelta = Math.abs(incomingAmount - expectedAmount);
  const amountMatches = amountDelta <= 0;

  if (!amountMatches) {
    return { kind: "mismatch", confidence: 0.35, reason: "amount-mismatch" };
  }

  if (input.hasOtherCandidate) {
    return { kind: "ambiguous", confidence: 0.7, reason: "multiple-candidates" };
  }

  if (normalizedIncomingPhone && normalizedPaymentPhone && normalizedIncomingPhone !== normalizedPaymentPhone) {
    return { kind: "mismatch", confidence: 0.4, reason: "phone-mismatch" };
  }

  if (input.tillNumber && input.paymentTillNumber && String(input.tillNumber) !== String(input.paymentTillNumber)) {
    return { kind: "mismatch", confidence: 0.4, reason: "till-mismatch" };
  }

  return { kind: "match", confidence: 0.95, reason: "exact" };
}
