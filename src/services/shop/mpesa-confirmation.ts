type RecentPayer = {
  customerName?: string | null;
  customerPhone?: string | null;
  transactionAmount?: string | null;
  createdAt?: Date | null;
};

export type RecentPayerSummary = {
  name: string;
  phone: string;
  amountMinor: number;
};

function parseAmountMinor(value?: string | null) {
  const normalized = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(normalized)) return 0;
  return Math.round(normalized * 100);
}

export function summarizeRecentPayers(entries: RecentPayer[], expectedAmountMinor: number) {
  const now = Date.now();
  const recent = (entries ?? []).filter((entry) => {
    if (!entry?.createdAt) return false;
    const createdAt = entry.createdAt.getTime();
    return now - createdAt <= 5 * 60 * 1000;
  });

  const matching = recent.filter((entry) => parseAmountMinor(entry.transactionAmount) === expectedAmountMinor);
  const byName = new Map<string, RecentPayerSummary>();

  for (const entry of matching) {
    const name = (entry.customerName ?? "Unknown customer").trim() || "Unknown customer";
    const phone = (entry.customerPhone ?? "").replace(/\D/g, "");
    const key = `${name.toLowerCase()}::${phone}`;
    if (!byName.has(key)) {
      byName.set(key, {
        name,
        phone: phone || "Unknown phone",
        amountMinor: expectedAmountMinor,
      });
    }
  }

  return Array.from(byName.values());
}
