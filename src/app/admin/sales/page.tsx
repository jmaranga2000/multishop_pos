import { requireAdmin } from "@/lib/rbac";
import { formatMoney } from "@/lib/utils";
import { getAdminSalesPageData } from "@/services/admin/sales-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const user = await requireAdmin();
  const { business, sales } = await getAdminSalesPageData(user.businessId);
  return (
    <>
      <PageHeading title="Sales ledger" description="Immutable completed sales from all shops, including synchronized offline transactions." />
      <Card className="overflow-hidden">
        <CardHeader><h2 className="font-extrabold">Recent sales</h2></CardHeader>
        {sales.length ? (
          <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Receipt</th><th>Shop</th><th>Date</th><th>Items</th><th>Payment</th><th>Total</th><th>Sync</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td className="font-mono text-xs font-bold">{sale.receiptNumber}</td><td>{sale.shop.name}</td><td>{sale.occurredAt.toLocaleString("en-KE")}</td><td>{sale._count.items}</td><td>{sale.payments.map((payment: typeof sale.payments[number]) => payment.method).join(", ")}</td><td className="font-black">{formatMoney(sale.total.toString(), business.currency)}</td><td>{sale.isOffline ? <Badge tone={sale.syncedAt ? "info" : "warning"}>{sale.syncedAt ? "Offline synced" : "Pending"}</Badge> : <Badge tone="success">Online</Badge>}</td></tr>)}</tbody></table></div>
        ) : <EmptyState title="No sales recorded" description="Sales will appear after a shop completes its first transaction." />}
      </Card>
    </>
  );
}
