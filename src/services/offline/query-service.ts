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

export async function listSynchronizationQueue(shopId: string) {
  return offlineDb.syncQueue.where("shopId").equals(shopId).toArray();
}

export async function getLastSynchronizationTime(shopId: string) {
  return (await offlineDb.syncMetadata.get(`lastSyncAt:${shopId}`))?.value ?? null;
}

export async function countPendingSynchronizationRecords(shopId: string) {
  return offlineDb.syncQueue.where("shopId").equals(shopId).filter((item) => ["PENDING_SYNC", "SYNCING", "FAILED"].includes(item.status)).count();
}

export async function countSynchronizationConflicts(shopId: string) {
  return offlineDb.syncQueue.where("shopId").equals(shopId).filter((item) => item.status === "CONFLICT").count();
}