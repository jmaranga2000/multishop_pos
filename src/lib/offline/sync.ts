"use client";

import { offlineDb } from "@/lib/offline/db";
import { hasPriceMismatchBetweenMinorUnits } from "@/lib/offline/price";
import type { OfflineInventory, OfflineProduct, OfflineSale, OfflineSaleItem, SyncQueueItem } from "@/lib/offline/types";

export type SyncPendingSalesOptions = {
  retryFailedOnly?: boolean;
};

export function getSyncQueueStatuses(options: SyncPendingSalesOptions = {}) {
  if (options.retryFailedOnly) return ["FAILED", "CONFLICT"] as const;
  return ["PENDING_SYNC", "FAILED"] as const;
}

export function getOrCreateDeviceId() {
  const key = "pos-device-id";
  let id = localStorage.getItem(key);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
  return id;
}

export async function bootstrapOfflineData() {
  if (!navigator.onLine) return { ok: false, offline: true };
  const deviceId = getOrCreateDeviceId();
  const response = await fetch(`/api/shop/bootstrap?deviceId=${encodeURIComponent(deviceId)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to synchronize the shop catalogue");
  const data = await response.json() as { shopId: string; products: OfflineProduct[]; inventory: OfflineInventory[]; syncedAt: string; offlineAccessExpiresAt: string };

  await offlineDb.transaction("rw", [offlineDb.offlineProducts, offlineDb.offlineInventory, offlineDb.syncMetadata], async () => {
    await offlineDb.offlineProducts.clear();
    await offlineDb.offlineInventory.clear();
    await offlineDb.offlineProducts.bulkPut(data.products);
    await offlineDb.offlineInventory.bulkPut(data.inventory);
    await offlineDb.syncMetadata.bulkPut([
      { key: "shopId", value: data.shopId },
      { key: "lastSyncAt", value: data.syncedAt },
      { key: "offlineAccessExpiresAt", value: data.offlineAccessExpiresAt },
    ]);
  });
  return { ok: true, ...data };
}

export async function createLocalSale(input: {
  shopId: string;
  salespersonId?: string | null;
  registerSessionId?: string | null;
  customerName?: string | null;
  paymentMethod: "CASH" | "MPESA" | "CARD" | "BANK_TRANSFER";
  paymentReference?: string | null;
  amountPaidMinor: number;
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    unitId?: string | null;
    unitName?: string | null;
    unitSymbol?: string | null;
    quantity: number;
    unitPriceMinor: number;
    unitCostMinor: number;
  }>;
}) {
  if (!navigator.onLine && input.paymentMethod !== "CASH") throw new Error("Only cash sales can be completed while offline.");
  const expires = await offlineDb.syncMetadata.get("offlineAccessExpiresAt");
  if (!navigator.onLine && (!expires || new Date(expires.value).getTime() < Date.now())) throw new Error("Offline access has expired. Reconnect before creating another sale.");

  const localId = crypto.randomUUID();
  const idempotencyKey = `sale:${input.shopId}:${localId}`;
  const deviceId = getOrCreateDeviceId();
  const subtotalMinor = input.items.reduce((sum, item) => sum + item.quantity * item.unitPriceMinor, 0);
  const totalMinor = subtotalMinor;
  const occurredAt = new Date().toISOString();
  const sale: OfflineSale = {
    localId, idempotencyKey, shopId: input.shopId, deviceId,
    salespersonId: input.salespersonId ?? null,
    registerSessionId: input.registerSessionId ?? null,
    customerName: input.customerName ?? null,
    subtotalMinor, discountMinor: 0, taxMinor: 0, totalMinor,
    amountPaidMinor: input.amountPaidMinor,
    changeDueMinor: Math.max(0, input.amountPaidMinor - totalMinor),
    paymentMethod: input.paymentMethod,
    paymentReference: input.paymentReference ?? null,
    occurredAt, status: "PENDING_SYNC",
  };
  const saleItems: OfflineSaleItem[] = input.items.map((item) => ({
    id: crypto.randomUUID(), saleLocalId: localId, productId: item.productId, productName: item.productName, sku: item.sku,
    unitId: item.unitId ?? null,
    unitName: item.unitName ?? null,
    unitSymbol: item.unitSymbol ?? null,
    quantity: item.quantity, unitPriceMinor: item.unitPriceMinor, unitCostMinor: item.unitCostMinor,
    lineTotalMinor: item.quantity * item.unitPriceMinor,
  }));

  await offlineDb.transaction("rw", [offlineDb.offlineSales, offlineDb.offlineSaleItems, offlineDb.offlineInventory, offlineDb.syncQueue], async () => {
    for (const item of input.items) {
      const inventory = await offlineDb.offlineInventory.where("[shopId+productId]").equals([input.shopId, item.productId]).first();
      if (!inventory || !inventory.isAvailable || inventory.projectedQuantity < item.quantity) throw new Error(`${item.productName} does not have enough projected stock.`);
    }
    await offlineDb.offlineSales.add(sale);
    await offlineDb.offlineSaleItems.bulkAdd(saleItems);
    for (const item of input.items) {
      const inventory = await offlineDb.offlineInventory.where("[shopId+productId]").equals([input.shopId, item.productId]).first();
      if (inventory) await offlineDb.offlineInventory.update(inventory.id, { projectedQuantity: inventory.projectedQuantity - item.quantity });
    }
    await offlineDb.syncQueue.add({ id: crypto.randomUUID(), entityType: "SALE", entityId: localId, idempotencyKey, shopId: input.shopId, deviceId, status: "PENDING_SYNC", attempts: 0, nextAttemptAt: occurredAt, createdAt: occurredAt });
  });

  if (navigator.onLine) await syncPendingSales();
  else if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    const syncManager = (registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync;
    await syncManager?.register("pos-sync").catch(() => undefined);
  }
  return sale;
}

export async function syncPendingSales(options: SyncPendingSalesOptions = {}) {
  if (!navigator.onLine) return { synced: 0, conflicts: 0, failed: 0, skipped: 0 };
  const statuses = getSyncQueueStatuses(options);
  const pending = await offlineDb.syncQueue.where("status").anyOf(statuses).toArray();
  if (!pending.length) return { synced: 0, conflicts: 0, failed: 0, skipped: 0 };

  const payload: Array<{ queueId: string; sale: OfflineSale; items: OfflineSaleItem[] }> = [];
  for (const queue of pending) {
    const sale = await offlineDb.offlineSales.get(queue.entityId);
    const items = await offlineDb.offlineSaleItems.where("saleLocalId").equals(queue.entityId).toArray();
    if (sale) payload.push({ queueId: queue.id, sale, items });
  }

  if (!payload.length) return { synced: 0, conflicts: 0, failed: pending.length, skipped: pending.length };

  await offlineDb.syncQueue.bulkUpdate(pending.map((item) => ({ key: item.id, changes: { status: "SYNCING" as const, attempts: item.attempts + 1 } })));

  try {
    const response = await fetch("/api/shop/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: getOrCreateDeviceId(), sales: payload }) });
    if (!response.ok) throw new Error(await response.text());
    const result = await response.json() as { results: Array<{ queueId: string; localId: string; serverId: string; receiptNumber: string; status: "SYNCED" | "CONFLICT"; conflicts: string[] }> };
    const resultMap = new Map(result.results.map((item) => [item.queueId, item]));
    await offlineDb.transaction("rw", [offlineDb.offlineSales, offlineDb.syncQueue, offlineDb.syncMetadata], async () => {
      for (const queue of pending) {
        const item = resultMap.get(queue.id);
        if (!item) {
          await offlineDb.syncQueue.update(queue.id, { status: "FAILED", lastError: "No response received from the server.", nextAttemptAt: new Date(Date.now() + 60_000).toISOString() });
          continue;
        }
        await offlineDb.offlineSales.update(item.localId, { status: item.status, serverId: item.serverId, receiptNumber: item.receiptNumber });
        if (item.status === "SYNCED") {
          await offlineDb.syncQueue.delete(queue.id);
        } else {
          await offlineDb.syncQueue.update(queue.id, { status: "CONFLICT", lastError: item.conflicts.join(", "), nextAttemptAt: new Date(Date.now() + 60_000).toISOString() });
        }
      }
      await offlineDb.syncMetadata.put({ key: "lastSyncAt", value: new Date().toISOString() });
    });
    await bootstrapOfflineData();
    return { synced: result.results.filter((item) => item.status === "SYNCED").length, conflicts: result.results.filter((item) => item.status === "CONFLICT").length, failed: 0, skipped: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synchronization failed";
    await offlineDb.syncQueue.bulkUpdate(pending.map((item) => ({ key: item.id, changes: { status: "FAILED" as const, lastError: message, nextAttemptAt: new Date(Date.now() + 60_000).toISOString() } })));
    throw error;
  }
}
