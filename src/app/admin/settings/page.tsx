import { requireAdmin } from "@/lib/rbac";
import { getAdminSettingsData } from "@/services/admin/settings-service";
import { PageHeading } from "@/components/ui/page-heading";
import { PushSettings } from "@/components/admin/push-settings";
import { AdminSettingsStatusCard, BusinessSettingsForm, NotificationPreferencesForm } from "@/components/admin/settings-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireAdmin();
  const business = await getAdminSettingsData(user.businessId);
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
