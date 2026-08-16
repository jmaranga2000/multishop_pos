export type SyncPendingSalesOptions = {
  retryFailedOnly?: boolean;
  shopId?: string;
};

export function getSyncQueueStatuses(options: SyncPendingSalesOptions = {}) {
  if (options.retryFailedOnly) return ["FAILED", "CONFLICT"] as const;
  return ["PENDING_SYNC", "FAILED", "CONFLICT"] as const;
}

export function detectMixedUnitSaleConflict(items: Array<{ productId: string; unitId?: string | null }>) {
  const productUnits = new Map<string, Set<string | null>>();

  for (const item of items) {
    const units = productUnits.get(item.productId) ?? new Set<string | null>();
    units.add(item.unitId ?? null);
    productUnits.set(item.productId, units);
  }

  return Array.from(productUnits.values()).some((units) => units.size > 1);
}
