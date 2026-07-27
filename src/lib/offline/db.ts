"use client";

import Dexie, { type Table } from "dexie";
import type { OfflineInventory, OfflineProduct, OfflineSale, OfflineSaleItem, SyncQueueItem } from "@/lib/offline/types";

export type SyncMetadata = { key: string; value: string };
export type AppPreference = { key: string; value: unknown };

class PosOfflineDatabase extends Dexie {
  offlineProducts!: Table<OfflineProduct, string>;
  offlineInventory!: Table<OfflineInventory, string>;
  offlineSales!: Table<OfflineSale, string>;
  offlineSaleItems!: Table<OfflineSaleItem, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  syncMetadata!: Table<SyncMetadata, string>;
  appPreferences!: Table<AppPreference, string>;

  constructor() {
    super("multishop-pos-offline");
    this.version(1).stores({
      offlineProducts: "id, sku, barcode, name, status",
      offlineInventory: "id, shopId, productId, [shopId+productId], projectedQuantity, syncedAt",
      offlineSales: "localId, shopId, status, occurredAt, idempotencyKey",
      offlineSaleItems: "id, saleLocalId, productId",
      syncQueue: "id, entityType, entityId, shopId, status, nextAttemptAt",
      syncMetadata: "key",
      appPreferences: "key",
    });
  }
}

export const offlineDb = new PosOfflineDatabase();
