"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { countPendingSynchronizationRecords, countSynchronizationConflicts, getLastSynchronizationTime } from "@/services/offline/query-service";
import { bootstrapOfflineData, syncPendingSales } from "@/services/offline/synchronization-service";

type SyncOptions = { retryFailedOnly?: boolean };

type OfflineContextValue = {
  shopId: string;
  shopName: string;
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  conflictCount: number;
  lastSyncAt: string | null;
  syncNow: (options?: SyncOptions) => Promise<void>;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children, shopId, shopName }: { children: React.ReactNode; shopId: string; shopName: string }) {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const lastSyncAt = useLiveQuery(() => getLastSynchronizationTime(), [], null);
  const pendingCount = useLiveQuery(() => countPendingSynchronizationRecords(), [], 0) ?? 0;
  const conflictCount = useLiveQuery(() => countSynchronizationConflicts(), [], 0) ?? 0;

  const syncNow = useCallback(async (options: SyncOptions = {}) => {
    if (!navigator.onLine || syncing) return;
    setSyncing(true);
    try {
      const result = await syncPendingSales(options);
      await bootstrapOfflineData();
      if (result.synced > 0) toast.success(`${result.synced} sale${result.synced === 1 ? "" : "s"} synchronized`);
      if (result.conflicts > 0) toast.warning(`${result.conflicts} sale${result.conflicts === 1 ? "" : "s"} need administrator review`);
      if (result.failed > 0) toast.error(`${result.failed} queued sale${result.failed === 1 ? "" : "s"} could not be synced`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Synchronization failed");
    } finally { setSyncing(false); }
  }, [syncing]);

  useEffect(() => {
    const handleOnline = () => { setOnline(true); void syncNow(); };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const swMessage = (event: MessageEvent) => { if (event.data?.type === "TRIGGER_POS_SYNC") void syncNow(); };
    navigator.serviceWorker?.addEventListener("message", swMessage);
    if (navigator.onLine) void (async () => { try { await bootstrapOfflineData(); await syncNow(); } catch { /* the cached data remains usable */ } })();
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); navigator.serviceWorker?.removeEventListener("message", swMessage); };
  }, [syncNow]);

  const value = useMemo(() => ({ shopId, shopName, online, syncing, pendingCount, conflictCount, lastSyncAt, syncNow }), [shopId, shopName, online, syncing, pendingCount, conflictCount, lastSyncAt, syncNow]);
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  const value = useContext(OfflineContext);
  if (!value) throw new Error("useOffline must be used inside OfflineProvider");
  return value;
}
