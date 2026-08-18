import { requireShop } from "@/lib/rbac";
import { createShopRequisitionAction, receiveGoodsShopAction } from "@/actions/shop/procurement-actions";
import { GoodsReceiptForm, RequisitionForm } from "@/components/procurement/workflow-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeading } from "@/components/ui/page-heading";
import { getShopProcurementData } from "@/services/procurement/procurement-service";

export const dynamic = "force-dynamic";

export default async function ShopProcurementPage() {
  const user = await requireShop();
  const data = await getShopProcurementData(user);
  const products = data.inventory.flatMap((row) => row.product ? [row.product] : []);
  const receiptOrders = data.purchaseOrders.filter((order) => ["APPROVED", "SENT", "PARTIALLY_RECEIVED"].includes(order.status));

  return (
    <>
      <PageHeading title="Procurement" description="Create stock requisitions for this shop, review their progress, and receive approved purchase orders." />

      <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">New requisition</h2>
              <p className="text-sm text-slate-500">Request stock for this shop. Requests need manager approval before an order can be sent.</p>
            </div>
          </CardHeader>
          <CardContent>
            <RequisitionForm action={createShopRequisitionAction} fixedShopId={user.shopId} suppliers={data.suppliers} products={products} />
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Request history</h2>
              <p className="text-sm text-slate-500">Procurement requests for this shop and their approval status.</p>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead><tr><th>Request</th><th>Supplier</th><th>Items</th><th>Status</th></tr></thead>
              <tbody>
                {data.requisitions.length ? data.requisitions.map((request) => (
                  <tr key={request.id}>
                    <td className="font-bold">{request.requisitionNumber}</td>
                    <td>{request.supplier?.name ?? "To be assigned"}</td>
                    <td>{request.items.map((item: { id: string; productName: string; requestedQuantity: number }) => <p key={item.id} className="text-xs">{item.productName} × {item.requestedQuantity}</p>)}</td>
                    <td><Badge tone={request.status === "APPROVED" || request.status === "CONVERTED" ? "success" : request.status === "REJECTED" ? "danger" : "warning"}>{request.status.replaceAll("_", " ")}</Badge></td>
                  </tr>
                )) : <tr><td colSpan={4} className="py-8 text-center text-slate-500">No procurement requests have been created for this shop.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <div>
            <h2 className="font-extrabold">Receive approved goods</h2>
            <p className="text-sm text-slate-500">Accepted quantities update this shop’s inventory; damaged and rejected quantities remain documented on the GRN.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {receiptOrders.length ? receiptOrders.map((order) => (
            <div key={order.id} className="rounded-xl border p-4">
              <p className="mb-3 font-bold">{order.purchaseOrderNumber} · {order.supplier?.name}</p>
              <GoodsReceiptForm action={receiveGoodsShopAction} order={{ id: order.id, items: order.items as Array<{ id: string; productName: string; orderedQuantity: number; receivedQuantity: number }> }} />
            </div>
          )) : <p className="text-sm text-slate-500">There are no approved purchase orders ready for this shop to receive.</p>}
        </CardContent>
      </Card>
    </>
  );
}