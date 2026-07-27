import { CheckCircle2, RefreshCw } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { getSynchronizationMonitorData } from "@/services/admin/synchronization-service";
import { resolveSynchronizationConflictAction } from "@/actions/admin/synchronization-actions";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminSyncPage() {
  const user = await requireAdmin();
  const { batches, conflicts } = await getSynchronizationMonitorData(user.businessId);
  return (
    <>
      <PageHeading title="Offline synchronization monitor" description="Review batches and resolve discrepancies without deleting preserved sales." />
      <div className="grid gap-4 lg:grid-cols-3"><Card className="p-5"><p className="text-sm text-slate-500">Recent batches</p><p className="mt-2 text-2xl font-black">{batches.length}</p></Card><Card className="p-5"><p className="text-sm text-slate-500">Open conflicts</p><p className="mt-2 text-2xl font-black text-red-600">{conflicts.length}</p></Card><Card className="p-5"><p className="text-sm text-slate-500">Successfully processed</p><p className="mt-2 text-2xl font-black text-emerald-700">{batches.reduce((sum, batch) => sum + batch.successCount, 0)}</p></Card></div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><h2 className="font-extrabold">Open reconciliation conflicts</h2></CardHeader><CardContent>{conflicts.length ? <div className="space-y-2">{conflicts.map((item) => <div key={item.id} className="rounded-xl border border-red-200 bg-red-50 p-3"><div className="flex items-center justify-between gap-2"><p className="font-bold text-red-800">{item.type.replaceAll("_", " ")}</p><Badge tone="danger">OPEN</Badge></div><p className="mt-1 text-sm text-red-700">{item.shop.name} • {item.entityType} {item.entityReference.slice(0, 12)}</p><p className="mt-1 text-xs text-red-600">{item.createdAt.toLocaleString("en-KE")} • {item.device.name}</p><form action={resolveSynchronizationConflictAction} className="mt-3"><input type="hidden" name="conflictId" value={item.id} /><Button size="sm" variant="success"><CheckCircle2 className="h-4 w-4" />Mark reconciled</Button></form></div>)}</div> : <EmptyState title="No open conflicts" description="Offline sales are currently reconciled with central stock." />}</CardContent></Card>
        <Card><CardHeader><h2 className="font-extrabold">Recent synchronization batches</h2></CardHeader><CardContent>{batches.length ? <div className="space-y-2">{batches.slice(0, 20).map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-3"><RefreshCw className="h-4 w-4 text-blue-700" /><div><p className="text-sm font-bold">{item.shop.name} • {item.device.name}</p><p className="text-xs text-slate-500">{item.recordCount} records • {item.startedAt.toLocaleString("en-KE")}</p></div></div><Badge tone={item.status === "COMPLETED" ? "success" : item.status === "FAILED" ? "danger" : "warning"}>{item.status}</Badge></div>)}</div> : <EmptyState title="No synchronization batches" description="Shop synchronization activity will appear here." />}</CardContent></Card>
      </div>
    </>
  );
}
