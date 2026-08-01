export type SaleLifecycleStatus = "LOCAL_ONLY" | "PENDING_SYNC" | "SYNCING" | "SYNCED" | "FAILED" | "CONFLICT";

export function describeSaleLifecycleMessage(status: SaleLifecycleStatus, online: boolean) {
  if (status === "SYNCED") return "Synced successfully";
  if (status === "CONFLICT") return "Sync conflict • review required";
  if (status === "FAILED") return "Sync failed • retry required";
  if (status === "SYNCING") return "Synchronizing";
  if (status === "LOCAL_ONLY") return "Stored locally • no sync yet";
  if (!online) return "Stored locally • pending sync";
  return "Submitted for synchronization";
}
