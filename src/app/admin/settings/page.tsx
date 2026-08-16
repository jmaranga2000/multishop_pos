import { requireAdmin } from "@/lib/rbac";
import { getAdminSettingsData } from "@/services/admin/settings-service";
import { PageHeading } from "@/components/ui/page-heading";
import { PushSettings } from "@/components/admin/push-settings";
import { AdminSettingsStatusCard, BusinessSettingsForm, NotificationPreferencesForm } from "@/components/admin/settings-forms";
import { EtimsConfigurationForm, TaxSettingsForm } from "@/components/admin/etims-settings-forms";
import { getAdminEtimsSettingsData } from "@/services/admin/etims-settings-service";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireAdmin();
  const [business, etims] = await Promise.all([
    getAdminSettingsData(user.businessId),
    getAdminEtimsSettingsData(user.businessId),
  ]);
  const preferences = business.notificationPreference;

  return (
    <>
      <PageHeading title="Business settings" description="Operational settings come from MongoDB; deployment secrets remain in environment variables." />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <BusinessSettingsForm business={business} />
        <div className="space-y-4">
          <AdminSettingsStatusCard />
          <PushSettings />
        </div>
      </div>
      <TaxSettingsForm settings={etims.taxSettings} />
      <EtimsConfigurationForm shops={etims.shops} configurations={etims.configurations} />
      <NotificationPreferencesForm preferences={preferences ?? {
        lowStockInApp: true,
        lowStockPush: true,
        lowStockEmail: false,
        criticalInApp: true,
        criticalPush: true,
        criticalEmail: true,
        outOfStockInApp: true,
        outOfStockPush: true,
        outOfStockEmail: true,
        weeklyReportInApp: true,
        weeklyReportPush: true,
        weeklyReportEmail: true,
      }} />
    </>
  );
}
