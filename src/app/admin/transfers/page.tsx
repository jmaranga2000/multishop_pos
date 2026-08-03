import { ArrowRight, PackageCheck, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { createTransferAction, dispatchTransferAction } from "@/actions/admin/transfer-actions";
import { getTransferManagementData } from "@/services/admin/transfer-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const user = await requireAdmin();
  const { shops, products, transfers } = await getTransferManagementData(user.businessId);
  const tone = (status: string) => status === "RECEIVED" ? "success" as const : status === "DRAFT" ? "neutral" as const : status === "CANCELLED" ? "danger" as const : "warning" as const;
  return (
    <>
      <PageHeading title="Stock transfers" description="Move stock between shops with dispatch and receipt confirmation." />
      <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
        <Card className="overflow-hidden">
          <CardHeader><h2 className="font-extrabold">Transfer history</h2></CardHeader>
          {transfers.length ? 
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transfer</th>
                  <th>Route</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                  </tr>
                  </thead>
                  <tbody>
                    {transfers.map((transfer) =>
                       <tr key={transfer.id}>
                        <td>
                          <p className="font-bold">{transfer.transferNumber}
                            </p>
                            </td>
                            <td>
                              <div className="flex items-center gap-2 text-sm">
                                <span>{transfer.sourceShop.name}</span>
                                <ArrowRight className="h-4 w-4 text-slate-400" />
                                <span>{transfer.destinationShop.name}</span>
                                </div></td><td>{transfer.items.map((item: typeof transfer.items[number]) => <p key={item.id} className="text-xs">{item.product?.name ?? "Deleted product"}: {item.requestedQuantity}</p>)}</td><td><Badge tone={tone(transfer.status)}>{transfer.status.replaceAll("_", " ")}</Badge></td><td>{transfer.createdAt?.toLocaleDateString("en-KE") ?? "Unknown date"}</td><td>{transfer.status === "DRAFT" ? <form action={dispatchTransferAction}><input type="hidden" name="transferId" value={transfer.id} /><Button size="sm"><PackageCheck className="h-4 w-4" />Dispatch</Button></form> : <span className="text-xs text-slate-500">Awaiting workflow</span>}</td></tr>)}</tbody></table></div> : <EmptyState title="No transfers" description="Create the first transfer using the form." />}
        </Card>
        <Card>
          <CardHeader><div><h2 className="font-extrabold">Create transfer</h2><p className="text-sm text-slate-500">Draft first, then dispatch after verification.</p></div></CardHeader>
          <CardContent><form action={createTransferAction} className="space-y-3"><select name="sourceShopId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Source shop</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select><select name="destinationShopId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Destination shop</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select><select name="productId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}</select><Input name="quantity" type="number" min="1" placeholder="Quantity" required /><textarea name="note" placeholder="Transfer note (optional)" className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm" /><Button className="w-full"><Plus className="h-4 w-4" />Create draft transfer</Button></form></CardContent>
        </Card>
      </div>
    </>
  );
}
