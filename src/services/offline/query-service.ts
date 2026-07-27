"use client";

import { offlineDb } from "@/lib/offline/db";

export async function listLocalSales(shopId: string) {
  const sales = await offlineDb.offlineSales.where("shopId").equals(shopId).toArray();
  return sales.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export async function listLocalInventory(shopId: string) {
  return offlineDb.offlineInventory.where("shopId").equals(shopId).toArray();
}

export async function listLocalInventoryWithProducts(shopId: string) {
  const inventory = await listLocalInventory(shopId);
  const products = await offlineDb.offlineProducts.bulkGet(inventory.map((item) => item.productId));
  return inventory.map((item, index) => ({ ...item, product: products[index] })).filter((item) => item.product);
}

export async function listSynchronizationQueue() {
  return offlineDb.syncQueue.toArray();
}

export async function getLastSynchronizationTime() {
  return (await offlineDb.syncMetadata.get("lastSyncAt"))?.value ?? null;
}

export async function countPendingSynchronizationRecords() {
  return offlineDb.syncQueue.where("status").anyOf(["PENDING_SYNC", "SYNCING", "FAILED"]).count();
}

export async function countSynchronizationConflicts() {
  return offlineDb.syncQueue.where("status").equals("CONFLICT").count();
}
