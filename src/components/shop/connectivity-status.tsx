"use client";

import { CheckCircle2, CloudUpload, RefreshCw, WifiOff, AlertTriangle } from "lucide-react";
import { useOffline } from "@/components/shop/offline-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConnectivityStatus() {
  const { online, syncing, pendingCount, conflictCount, lastSyncAt, syncNow } = useOffline();
  const Icon = !online ? WifiOff : syncing ? RefreshCw : conflictCount ? AlertTriangle : pendingCount ? CloudUpload : CheckCircle2;
  const label = !online ? "Offline" : syncing ? "Synchronizing" : conflictCount ? `${conflictCount} conflict${conflictCount === 1 ? "" : "s"}` : pendingCount ? `${pendingCount} pending` : "Synchronized";
  return <div className="flex items-center gap-2">
    <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold", !online ? "border-amber-200 bg-amber-50 text-amber-800" : conflictCount ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
      <Icon className={cn("h-4 w-4", syncing && "animate-spin")} />{label}<span className="hide-mobile font-normal opacity-70">{lastSyncAt ? `• ${new Date(lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
    </div>
    {online && (pendingCount > 0 || conflictCount > 0) && <Button size="sm" variant="secondary" onClick={() => void syncNow()} disabled={syncing}><RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />Sync</Button>}
  </div>;
}
