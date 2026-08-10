import { requireAdmin } from "@/lib/rbac";
import { getSupplierManagementDetails, getSupplierNotificationHistory, listSupplierProductsForBusiness } from "@/services/admin/supplier-service";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardHeader } from "@/components/ui/card";
import { SupplierEditForm } from "@/components/admin/supplier-edit-form";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: supplierId } = await params;
  const admin = await requireAdmin();

  const details = await getSupplierManagementDetails(admin.businessId, supplierId);
  if (!details) notFound();

  const { supplier } = details;

  const [shops, products, notificationHistory] = await Promise.all([
    db.shop.findMany({
      where: { businessId: admin.businessId },
      orderBy: { name: "asc" },
    }),
    listSupplierProductsForBusiness(admin.businessId),
    getSupplierNotificationHistory(admin.businessId, { supplierId: supplier.id }),
  ]);

  const pendingNotifications = notificationHistory.filter((entry) => entry.status === "PENDING");
  const sentNotifications = notificationHistory.filter((entry) => entry.status === "SENT");
  const failedNotifications = notificationHistory.filter((entry) => entry.status === "FAILED");

  return (
    <>
      <PageHeading title={supplier.name} description={supplier.company} />
      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <h2 className="font-extrabold">Supplier details</h2>
          </CardHeader>
          <div className="p-6">
            <SupplierEditForm
              supplier={supplier}
              shops={shops}
              products={products}
              selectedProductIds={supplier.supplierProducts.map((entry: { productId: string }) => entry.productId)}
            />
          </div>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="font-extrabold">Quotation notifications</h2>
          </CardHeader>
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pending</h3>
              {pendingNotifications.length ? (
                <ul className="mt-3 space-y-3">
                  {pendingNotifications.map((entry) => (
                    <li key={entry.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{entry.subject}</p>
                          <p className="text-xs text-slate-500">{new Date(entry.createdAt ?? new Date()).toLocaleString()}</p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Pending</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No pending supplier quotations.</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Sent</h3>
              {sentNotifications.length ? (
                <ul className="mt-3 space-y-3">
                  {sentNotifications.map((entry) => (
                    <li key={entry.id} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{entry.subject}</p>
                          <p className="text-xs text-slate-500">Sent {new Date(entry.sentAt ?? entry.createdAt ?? new Date()).toLocaleString()}</p>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Sent</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No sent supplier quotations.</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Failed</h3>
              {failedNotifications.length ? (
                <ul className="mt-3 space-y-3">
                  {failedNotifications.map((entry) => (
                    <li key={entry.id} className="rounded-2xl border border-red-200 bg-red-50 p-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{entry.subject}</p>
                            <p className="text-xs text-slate-500">Failed {new Date(entry.failedAt ?? entry.createdAt ?? new Date()).toLocaleString()}</p>
                          </div>
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">Failed</span>
                        </div>
                        {entry.failureReason ? <p className="text-sm text-red-700">{entry.failureReason}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No failed supplier quotations.</p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
