import Link from "next/link";
import { MonitorSmartphone, RefreshCcw, AlertTriangle } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { getAdminDeviceById } from "@/services/admin/device-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function DeviceDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const device = await getAdminDeviceById(user.businessId, id);

  if (!device) return <p className="p-6">Device not found.</p>;

  const enabled = device.isActive && device.isTrusted;

  return (
    <>
      <PageHeading title={device.name} description={`Shop: ${device.shop.name}`} />
      <div className="mb-4">
        <Link href="/admin/devices" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Back to list
        </Link>
      </div>

      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Device details</h2>
              <p className="text-sm text-slate-500">Trusted offline shop client registry and recent activity.</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Device name</p>
                <p className="mt-1 font-bold">{device.name}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Platform</p>
                <p className="mt-1 font-bold">{device.platform ?? "Unknown"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Shop</p>
                <p className="mt-1 font-bold">{device.shop.name}</p>
                <p className="text-sm text-slate-500">{device.shop.code}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                <div className="mt-1">
                  <Badge tone={enabled ? "success" : "danger"}>{enabled ? "Trusted" : "Revoked"}</Badge>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Last seen</p>
                <p className="mt-1 font-bold">{device.lastSeenAt.toLocaleString("en-KE")}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Last sync</p>
                <p className="mt-1 font-bold">{device.lastSyncAt?.toLocaleString("en-KE") ?? "Never"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Offline access until</p>
                <p className="mt-1 font-bold">{device.offlineAccessExpiresAt.toLocaleString("en-KE")}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">User agent</p>
                <p className="mt-1 font-bold text-sm break-all">{device.userAgent ?? "Not available"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Recent sync batches</h2>
              <p className="text-sm text-slate-500">Latest offline sync runs associated with this device.</p>
            </div>
          </CardHeader>
          <CardContent>
            {device.syncBatches.length ? (
              <div className="space-y-3">
                {device.syncBatches.map((batch: { id: string; status: string; startedAt: Date; recordCount: number; successCount: number; conflictCount: number }) => (
                  <div key={batch.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm">{batch.status}</p>
                        <p className="text-xs text-slate-500">Started {batch.startedAt.toLocaleString("en-KE")}</p>
                      </div>
                      <div className="text-right text-sm text-slate-600">
                        <p>{batch.recordCount} records</p>
                        <p>{batch.successCount} succeeded • {batch.conflictCount} conflicts</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No sync batches have been recorded for this device yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Open device events</h2>
              <p className="text-sm text-slate-500">The most recent conflict and synchronization events tied to this device.</p>
            </div>
          </CardHeader>
          <CardContent>
            {device.conflicts.length ? (
              <div className="space-y-3">
                {device.conflicts.map((conflict: { id: string; type: string; entityType: string; status: string; details: Record<string, unknown>; createdAt: Date }) => (
                  <div key={conflict.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-amber-50 p-2 text-amber-700"><AlertTriangle className="h-4 w-4" /></div>
                        <div>
                          <p className="font-bold text-sm">{conflict.type.replaceAll("_", " ")}</p>
                          <p className="text-xs text-slate-500">{conflict.entityType} • {conflict.status}</p>
                          <p className="mt-1 text-sm text-slate-700">{String(conflict.details ?? "No detail available")}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">{conflict.createdAt.toLocaleString("en-KE")}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No events are currently attached to this device.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Device summary</h2>
              <p className="text-sm text-slate-500">At-a-glance counts for the currently linked offline metadata.</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500"><MonitorSmartphone className="h-3.5 w-3.5" />Device</p>
                <p className="mt-1 font-bold">{device.name}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500"><RefreshCcw className="h-3.5 w-3.5" />Sync batches</p>
                <p className="mt-1 font-bold">{device._count.syncBatches}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500"><AlertTriangle className="h-3.5 w-3.5" />Conflicts</p>
                <p className="mt-1 font-bold">{device._count.conflicts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
