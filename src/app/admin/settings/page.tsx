import { Save } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { getAdminSettingsData } from "@/services/admin/settings-service";
import { updateBusinessSettingsAction, updateNotificationPreferencesAction } from "@/actions/admin/settings-actions";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PushSettings } from "@/components/admin/push-settings";

export const dynamic = "force-dynamic";

const checkboxClass = "h-4 w-4 rounded border-slate-300 text-blue-700";

export default async function SettingsPage() {
  const user = await requireAdmin();
  const business = await getAdminSettingsData(user.businessId);
  const preferences = business.notificationPreference;

  return (
    <>
      <PageHeading title="Business settings" description="Operational settings come from MongoDB; deployment secrets remain in environment variables." />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader><div><h2 className="font-extrabold">Business and operations</h2><p className="text-sm text-slate-500">These values are loaded by reports, receipts, stock defaults and offline clients.</p></div></CardHeader>
          <CardContent>
            <form action={updateBusinessSettingsAction} className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2"><label className="mb-1 block text-xs font-bold text-slate-600">Business name</label><Input name="name" defaultValue={business.name} required /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Email</label><Input name="email" type="email" defaultValue={business.email ?? ""} /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Phone</label><Input name="phone" defaultValue={business.phone ?? ""} /></div>
              <div className="md:col-span-2"><label className="mb-1 block text-xs font-bold text-slate-600">Address</label><Input name="address" defaultValue={business.address ?? ""} /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Tax PIN</label><Input name="taxPin" defaultValue={business.taxPin ?? ""} /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Currency</label><Input name="currency" defaultValue={business.currency} maxLength={3} required /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Timezone</label><Input name="timezone" defaultValue={business.timezone} required /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Offline session hours</label><Input name="offlineSessionHours" type="number" min="1" max="168" defaultValue={business.offlineSessionHours} required /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Sync interval (minutes)</label><Input name="syncIntervalMinutes" type="number" min="1" max="1440" defaultValue={business.syncIntervalMinutes} required /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Default reorder level</label><Input name="defaultReorderLevel" type="number" min="0" defaultValue={business.defaultReorderLevel} required /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Default critical level</label><Input name="defaultCriticalLevel" type="number" min="0" defaultValue={business.defaultCriticalLevel} required /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Weekly report day (0–6)</label><Input name="weeklyReportDay" type="number" min="0" max="6" defaultValue={business.weeklyReportDay} required /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Weekly report hour (0–23)</label><Input name="weeklyReportHour" type="number" min="0" max="23" defaultValue={business.weeklyReportHour} required /></div>
              <div className="md:col-span-2"><label className="mb-1 block text-xs font-bold text-slate-600">Receipt footer</label><textarea name="receiptFooter" defaultValue={business.receiptFooter ?? ""} className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm" /></div>
              <div className="md:col-span-2"><Button><Save className="h-4 w-4" />Save business settings</Button></div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><h2 className="font-extrabold">Integration status</h2></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between rounded-xl bg-slate-50 p-3"><span className="text-sm font-semibold">SMTP</span><Badge tone={process.env.SMTP_HOST ? "success" : "warning"}>{process.env.SMTP_HOST ? "Configured" : "Not configured"}</Badge></div>
              <div className="flex justify-between rounded-xl bg-slate-50 p-3"><span className="text-sm font-semibold">Web Push / VAPID</span><Badge tone={process.env.VAPID_PRIVATE_KEY ? "success" : "warning"}>{process.env.VAPID_PRIVATE_KEY ? "Configured" : "Not configured"}</Badge></div>
              <div className="flex justify-between rounded-xl bg-slate-50 p-3"><span className="text-sm font-semibold">Cron protection</span><Badge tone={process.env.CRON_SECRET ? "success" : "warning"}>{process.env.CRON_SECRET ? "Configured" : "Not configured"}</Badge></div>
            </CardContent>
          </Card>
          <PushSettings />
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader><div><h2 className="font-extrabold">Notification channels</h2><p className="text-sm text-slate-500">Choose how the administrator receives stock and weekly-report events.</p></div></CardHeader>
        <CardContent>
          <form action={updateNotificationPreferencesAction} className="space-y-4">
            {[
              ["Low stock", "lowStock", preferences?.lowStockInApp ?? true, preferences?.lowStockPush ?? true, preferences?.lowStockEmail ?? false],
              ["Critical stock", "critical", preferences?.criticalInApp ?? true, preferences?.criticalPush ?? true, preferences?.criticalEmail ?? true],
              ["Out of stock", "outOfStock", preferences?.outOfStockInApp ?? true, preferences?.outOfStockPush ?? true, preferences?.outOfStockEmail ?? true],
              ["Weekly report", "weeklyReport", preferences?.weeklyReportInApp ?? true, preferences?.weeklyReportPush ?? true, preferences?.weeklyReportEmail ?? true],
            ].map(([label, prefix, inApp, push, email]) => (
              <div key={String(prefix)} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                <p className="font-bold">{String(label)}</p>
                <label className="flex items-center gap-2 text-sm"><input className={checkboxClass} type="checkbox" name={`${prefix}InApp`} defaultChecked={Boolean(inApp)} />In-app</label>
                <label className="flex items-center gap-2 text-sm"><input className={checkboxClass} type="checkbox" name={`${prefix}Push`} defaultChecked={Boolean(push)} />Push</label>
                <label className="flex items-center gap-2 text-sm"><input className={checkboxClass} type="checkbox" name={`${prefix}Email`} defaultChecked={Boolean(email)} />Email</label>
              </div>
            ))}
            <Button><Save className="h-4 w-4" />Save notification preferences</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
