import Link from "next/link";
import { MonitorSmartphone, ShieldCheck, ShieldX } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { listBusinessDevices } from "@/services/admin/device-service";
import { setDeviceAccessAction } from "@/actions/admin/device-actions";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  const user = await requireAdmin();
  const devices = await listBusinessDevices(user.businessId);
  return (
    <>
      <PageHeading title="Trusted shop devices" description="Devices become visible after an authenticated shop synchronizes its offline catalogue." />
      <Card className="overflow-hidden">
        {devices.length ? (
          <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Device</th><th>Shop</th><th>Last seen</th><th>Last sync</th><th>Offline access expires</th><th>Conflicts</th><th>Status</th><th>Action</th></tr></thead><tbody>{devices.map((device) => {
            const enabled = device.isActive && device.isTrusted;
            return <tr key={device.id}><td><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2 text-blue-700"><MonitorSmartphone className="h-4 w-4" /></div><div><p className="font-bold">{device.name}</p><p className="max-w-56 truncate text-xs text-slate-500">{device.platform ?? device.id}</p></div></div></td><td>{device.shop.name}</td><td>{device.lastSeenAt.toLocaleString("en-KE")}</td><td>{device.lastSyncAt?.toLocaleString("en-KE") ?? "Never"}</td><td>{device.offlineAccessExpiresAt.toLocaleString("en-KE")}</td><td>{device._count.conflicts}</td><td><Badge tone={enabled ? "success" : "danger"}>{enabled ? "Trusted" : "Revoked"}</Badge></td><td><div className="flex flex-wrap gap-2"><Link href={`/admin/devices/${device.id}`} className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">View</Link><form action={setDeviceAccessAction}><input type="hidden" name="deviceId" value={device.id} /><input type="hidden" name="enabled" value={String(!enabled)} /><Button size="sm" variant={enabled ? "danger" : "success"}>{enabled ? <ShieldX className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}{enabled ? "Revoke" : "Trust"}</Button></form></div></td></tr>;
          })}</tbody></table></div>
        ) : <EmptyState title="No registered devices" description="A device is registered after a shop signs in and performs its first online synchronization." />}
      </Card>
    </>
  );
}
