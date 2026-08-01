"use client";

import { Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateBusinessSettingsAction, updateNotificationPreferencesAction } from "@/actions/admin/settings-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const checkboxClass = "h-4 w-4 rounded border-slate-300 text-blue-700";

type BusinessSettingsFormProps = {
  business: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    taxPin?: string | null;
    currency: string;
    timezone: string;
    receiptFooter?: string | null;
    defaultReorderLevel: number;
    defaultCriticalLevel: number;
    offlineSessionHours: number;
    syncIntervalMinutes: number;
    weeklyReportDay: number;
    weeklyReportHour: number;
    posBarcodeScanningEnabled: boolean;
  };
};

export function BusinessSettingsForm({ business }: BusinessSettingsFormProps) {
  const initialValues = {
    name: business.name,
    email: business.email ?? "",
    phone: business.phone ?? "",
    address: business.address ?? "",
    taxPin: business.taxPin ?? "",
    currency: business.currency,
    timezone: business.timezone,
    receiptFooter: business.receiptFooter ?? "",
    defaultReorderLevel: String(business.defaultReorderLevel),
    defaultCriticalLevel: String(business.defaultCriticalLevel),
    offlineSessionHours: String(business.offlineSessionHours),
    syncIntervalMinutes: String(business.syncIntervalMinutes),
    weeklyReportDay: String(business.weeklyReportDay),
    weeklyReportHour: String(business.weeklyReportHour),
    posBarcodeScanningEnabled: Boolean(business.posBarcodeScanningEnabled),
  };

  const [values, setValues] = useState(initialValues);
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();

  function setField<K extends keyof typeof initialValues>(key: K, value: (typeof initialValues)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty) return;
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await updateBusinessSettingsAction(formData);
        setDirty(false);
        toast.success("Business settings saved");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save business settings");
      }
    });
  }

  return (
    <Card>
      <CardHeader><div><h2 className="font-extrabold">Business and operations</h2><p className="text-sm text-slate-500">These values are loaded by reports, receipts, stock defaults and offline clients.</p></div></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><label className="mb-1 block text-xs font-bold text-slate-600">Business name</label><Input name="name" value={values.name} onChange={(event) => setField("name", event.target.value)} required /></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">Email</label><Input name="email" type="email" value={values.email} onChange={(event) => setField("email", event.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">Phone</label><Input name="phone" value={values.phone} onChange={(event) => setField("phone", event.target.value)} /></div>
          <div className="md:col-span-2"><label className="mb-1 block text-xs font-bold text-slate-600">Address</label><Input name="address" value={values.address} onChange={(event) => setField("address", event.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">Tax PIN</label><Input name="taxPin" value={values.taxPin} onChange={(event) => setField("taxPin", event.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">Currency</label><Input name="currency" value={values.currency} onChange={(event) => setField("currency", event.target.value)} maxLength={3} required /></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">Timezone</label><Input name="timezone" value={values.timezone} onChange={(event) => setField("timezone", event.target.value)} required /></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">Offline session hours</label><Input name="offlineSessionHours" type="number" min="1" max="168" value={values.offlineSessionHours} onChange={(event) => setField("offlineSessionHours", event.target.value)} required /></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">Sync interval (minutes)</label><Input name="syncIntervalMinutes" type="number" min="1" max="1440" value={values.syncIntervalMinutes} onChange={(event) => setField("syncIntervalMinutes", event.target.value)} required /></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">Default reorder level</label><Input name="defaultReorderLevel" type="number" min="0" value={values.defaultReorderLevel} onChange={(event) => setField("defaultReorderLevel", event.target.value)} required /></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">Default critical level</label><Input name="defaultCriticalLevel" type="number" min="0" value={values.defaultCriticalLevel} onChange={(event) => setField("defaultCriticalLevel", event.target.value)} required /></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">Weekly report day (0–6)</label><Input name="weeklyReportDay" type="number" min="0" max="6" value={values.weeklyReportDay} onChange={(event) => setField("weeklyReportDay", event.target.value)} required /></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-600">Weekly report hour (0–23)</label><Input name="weeklyReportHour" type="number" min="0" max="23" value={values.weeklyReportHour} onChange={(event) => setField("weeklyReportHour", event.target.value)} required /></div>
          <div className="md:col-span-2"><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input className={checkboxClass} type="checkbox" name="posBarcodeScanningEnabled" checked={values.posBarcodeScanningEnabled} onChange={(event) => setField("posBarcodeScanningEnabled", event.target.checked)} />Enable barcode scanning on the shop POS</label></div>
          <div className="md:col-span-2"><label className="mb-1 block text-xs font-bold text-slate-600">Receipt footer</label><textarea name="receiptFooter" value={values.receiptFooter} onChange={(event) => setField("receiptFooter", event.target.value)} className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm" /></div>
          <div className="md:col-span-2"><Button type="submit" disabled={!dirty || isPending}>{isPending ? "Saving..." : "Save business settings"}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

type NotificationPreferencesFormProps = {
  preferences: {
    lowStockInApp: boolean;
    lowStockPush: boolean;
    lowStockEmail: boolean;
    criticalInApp: boolean;
    criticalPush: boolean;
    criticalEmail: boolean;
    outOfStockInApp: boolean;
    outOfStockPush: boolean;
    outOfStockEmail: boolean;
    weeklyReportInApp: boolean;
    weeklyReportPush: boolean;
    weeklyReportEmail: boolean;
  };
};

export function NotificationPreferencesForm({ preferences }: NotificationPreferencesFormProps) {
  const initialValues = {
    lowStockInApp: Boolean(preferences.lowStockInApp),
    lowStockPush: Boolean(preferences.lowStockPush),
    lowStockEmail: Boolean(preferences.lowStockEmail),
    criticalInApp: Boolean(preferences.criticalInApp),
    criticalPush: Boolean(preferences.criticalPush),
    criticalEmail: Boolean(preferences.criticalEmail),
    outOfStockInApp: Boolean(preferences.outOfStockInApp),
    outOfStockPush: Boolean(preferences.outOfStockPush),
    outOfStockEmail: Boolean(preferences.outOfStockEmail),
    weeklyReportInApp: Boolean(preferences.weeklyReportInApp),
    weeklyReportPush: Boolean(preferences.weeklyReportPush),
    weeklyReportEmail: Boolean(preferences.weeklyReportEmail),
  };

  const [values, setValues] = useState(initialValues);
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();

  function updateFlag(name: keyof typeof initialValues) {
    setValues((current) => ({ ...current, [name]: !current[name] }));
    setDirty(true);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty) return;
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await updateNotificationPreferencesAction(formData);
        setDirty(false);
        toast.success("Notification preferences saved");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save notification preferences");
      }
    });
  }

  return (
    <Card className="mt-4">
      <CardHeader><div><h2 className="font-extrabold">Notification channels</h2><p className="text-sm text-slate-500">Choose how the administrator receives stock and weekly-report events.</p></div></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {[
            ["Low stock", "lowStock", values.lowStockInApp, values.lowStockPush, values.lowStockEmail],
            ["Critical stock", "critical", values.criticalInApp, values.criticalPush, values.criticalEmail],
            ["Out of stock", "outOfStock", values.outOfStockInApp, values.outOfStockPush, values.outOfStockEmail],
            ["Weekly report", "weeklyReport", values.weeklyReportInApp, values.weeklyReportPush, values.weeklyReportEmail],
          ].map(([label, prefix, inApp, push, email]) => (
            <div key={String(prefix)} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
              <p className="font-bold">{String(label)}</p>
              <label className="flex items-center gap-2 text-sm"><input className={checkboxClass} type="checkbox" name={`${prefix}InApp`} checked={Boolean(inApp)} onChange={() => updateFlag(`${String(prefix)}InApp` as keyof typeof initialValues)} />In-app</label>
              <label className="flex items-center gap-2 text-sm"><input className={checkboxClass} type="checkbox" name={`${prefix}Push`} checked={Boolean(push)} onChange={() => updateFlag(`${String(prefix)}Push` as keyof typeof initialValues)} />Push</label>
              <label className="flex items-center gap-2 text-sm"><input className={checkboxClass} type="checkbox" name={`${prefix}Email`} checked={Boolean(email)} onChange={() => updateFlag(`${String(prefix)}Email` as keyof typeof initialValues)} />Email</label>
            </div>
          ))}
          <Button type="submit" disabled={!dirty || isPending}>{isPending ? "Saving..." : "Save notification preferences"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function AdminSettingsStatusCard() {
  return (
    <Card>
      <CardHeader><h2 className="font-extrabold">Integration status</h2></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between rounded-xl bg-slate-50 p-3"><span className="text-sm font-semibold">SMTP</span><Badge tone={process.env.SMTP_HOST ? "success" : "warning"}>{process.env.SMTP_HOST ? "Configured" : "Not configured"}</Badge></div>
        <div className="flex justify-between rounded-xl bg-slate-50 p-3"><span className="text-sm font-semibold">Web Push / VAPID</span><Badge tone={process.env.VAPID_PRIVATE_KEY ? "success" : "warning"}>{process.env.VAPID_PRIVATE_KEY ? "Configured" : "Not configured"}</Badge></div>
        <div className="flex justify-between rounded-xl bg-slate-50 p-3"><span className="text-sm font-semibold">Cron protection</span><Badge tone={process.env.CRON_SECRET ? "success" : "warning"}>{process.env.CRON_SECRET ? "Configured" : "Not configured"}</Badge></div>
      </CardContent>
    </Card>
  );
}

export function SaveButtonLabel({ isPending, label }: { isPending: boolean; label: string }) {
  return <>
    <Save className="h-4 w-4" />
    {isPending ? "Saving..." : label}
  </>;
}
