import Link from "next/link";
import { Bell, CheckCheck, CircleAlert } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { listAdminNotifications } from "@/services/admin/notification-service";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/actions/admin/notification-actions";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { PushSettings } from "@/components/admin/push-settings";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireAdmin();
  const notifications = await listAdminNotifications(user.id);
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  return (
    <>
      <PageHeading
        title="Notification centre"
        description="Stock, reports, refunds, registers and synchronization events in one place."
        actions={unreadCount ? <form action={markAllNotificationsReadAction}><Button variant="secondary"><CheckCheck className="h-4 w-4" />Mark all read</Button></form> : undefined}
      />
      <PushSettings />
      <Card className="mt-4">
        <CardContent className="pt-5">
          {notifications.length ? (
            <div className="space-y-2">
              {notifications.map((item) => (
                <div key={item.id} className={`flex items-start gap-3 rounded-2xl border p-4 ${item.isRead ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50/60"}`}>
                  <div className={`rounded-xl p-2 ${item.priority === "URGENT" || item.priority === "HIGH" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-700"}`}>
                    {item.priority === "URGENT" ? <CircleAlert className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-extrabold">{item.title}</p><Badge tone={item.priority === "URGENT" || item.priority === "HIGH" ? "danger" : "info"}>{item.type.replaceAll("_", " ")}</Badge></div>
                    <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                    <p className="mt-2 text-xs text-slate-400">{item.shop?.name ?? "Business-wide"} • {item.createdAt.toLocaleString("en-KE")}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.actionUrl ? <Link href={item.actionUrl}><Button size="sm" variant="secondary">Open</Button></Link> : null}
                      {!item.isRead ? <form action={markNotificationReadAction}><input type="hidden" name="notificationId" value={item.id} /><Button size="sm" variant="ghost">Mark read</Button></form> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No notifications" description="Operational events and stock alerts will appear here." />}
        </CardContent>
      </Card>
    </>
  );
}
