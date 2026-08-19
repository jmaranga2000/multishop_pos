import { requireAdmin } from "@/lib/rbac";
import { formatMoney } from "@/lib/utils";
import { getAdminSalesPageData, type AdminSale } from "@/services/admin/sales-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SalesPdfExportButton } from "@/components/admin/sales-pdf-export-button";
import { endOfMonth, endOfQuarter, endOfWeek, isSameDay } from "date-fns";

export const dynamic = "force-dynamic";

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function groupSalesByDate(sales: AdminSale[]) {
  return sales.reduce<Array<{ label: string; key: string; items: AdminSale[] }>>((groups, sale) => {
    const date = sale.occurredAt instanceof Date ? sale.occurredAt : new Date(sale.occurredAt);
    const key = date.toISOString().slice(0, 10);
    const label = formatDateLabel(date);
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.items.push(sale);
    } else {
      groups.push({ label, key, items: [sale] });
    }
    return groups;
  }, []);
}

export default async function SalesPage() {
  const user = await requireAdmin();
  const { business, sales } = await getAdminSalesPageData(user.businessId);
  const groups = groupSalesByDate(sales);
  const today = new Date();
  const showWeek = isSameDay(today, endOfWeek(today));
  const showMonth = isSameDay(today, endOfMonth(today));
  const showQuarter = isSameDay(today, endOfQuarter(today));

  const actionButtons = [
    <SalesPdfExportButton key="today" period="today" label="Download today sales" />,
  ];
  if (showWeek) actionButtons.push(<SalesPdfExportButton key="week" period="week" label="Download weekly sales" />);
  if (showMonth) actionButtons.push(<SalesPdfExportButton key="month" period="month" label="Download monthly sales" />);
  if (showQuarter) actionButtons.push(<SalesPdfExportButton key="quarter" period="quarter" label="Download quarterly sales" />);

  const availableExports = [
    "Today",
    showWeek ? "This week" : null,
    showMonth ? "This month" : null,
    showQuarter ? "This quarter" : null,
  ].filter(Boolean).join(", ");

  return (
    <>
      <PageHeading
        title="Sales ledger"
        description="Immutable completed sales from all shops, including synchronized offline transactions."
        actions={<div className="flex flex-wrap gap-2">{actionButtons}</div>}
      />
      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Sales export summary</p>
        <p className="mt-2">
          Download today&apos;s sales at any time. Additional exports become available when the current date closes a reporting period.
        </p>
        <p className="mt-2 text-slate-600">
          Available exports: <span className="font-semibold">{availableExports}</span>
        </p>
      </div>
      <Card className="overflow-hidden">
        <CardHeader><h2 className="font-extrabold">Recent sales</h2></CardHeader>
        {groups.length ? (
          <div className="space-y-6 p-4">
            {groups.map((group) => (
              <div key={group.key}>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{group.label}</h3>
                    <p className="text-sm text-slate-500">{group.items.length} sale{group.items.length === 1 ? "" : "s"}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Receipt</th>
                        <th>Shop</th>
                        <th>Counter</th>
                        <th>Time</th>
                        <th>Items</th>
                        <th>Products sold</th>
                        <th>Payment</th>
                        <th>Total</th>
                        <th>Sync</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((sale) => (
                        <tr key={sale.id}>
                          <td className="font-mono text-xs font-bold">{sale.receiptNumber}</td>
                          <td>{sale.shop.name}</td>
                          <td>{sale.counter ? <div><p className="font-medium">{sale.counter.name}</p><p className="text-xs text-slate-500">{sale.counter.code}</p></div> : <span className="text-slate-500">—</span>}</td>
                          <td>{new Date(sale.occurredAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</td>
                          <td>{sale._count.items}</td>
                          <td>
                            {sale.products?.length ? (
                              <div className="max-w-xs space-y-1">
                                {sale.products.slice(0, 3).map((product, index) => (
                                  <div key={`${sale.id}-${product.name}-${index}`} className="text-sm text-slate-700">
                                    <span className="font-medium">{product.name}</span>
                                    <span className="ml-1 text-slate-500">× {product.quantity}</span>
                                  </div>
                                ))}
                                {sale.products.length > 3 ? <p className="text-xs text-slate-500">+{sale.products.length - 3} more</p> : null}
                              </div>
                            ) : (
                              <span className="text-sm text-slate-500">—</span>
                            )}
                          </td>
                          <td>{sale.payments.map((payment: typeof sale.payments[number]) => payment.method).join(", ")}</td>
                          <td className="font-black">{formatMoney(sale.total.toString(), business.currency)}</td>
                          <td>
                            {sale.isOffline ? (
                              <Badge tone={sale.syncedAt ? "info" : "warning"}>{sale.syncedAt ? "Offline synced" : "Pending"}</Badge>
                            ) : (
                              <Badge tone="success">Online</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No sales recorded" description="Sales will appear after a shop completes its first transaction." />
        )}
      </Card>
    </>
  );
}
