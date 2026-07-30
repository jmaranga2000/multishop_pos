import { ArrowDownToLine, PackageOpen } from "lucide-react";
import { requireShop } from "@/lib/rbac";
import { receiveTransferAction } from "@/actions/shop/transfer-actions";
import { listIncomingTransfers } from "@/services/shop/transfer-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const user = await requireShop();
  const transfers = await listIncomingTransfers(user.shopId);
  return <><PageHeading title="Incoming transfers" description="Confirm stock received from another shop before it becomes available for sale." /><Card className="overflow-hidden"><CardHeader><h2 className="font-extrabold">Transfer history</h2></CardHeader>{transfers.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Transfer</th><th>Source</th><th>Products</th><th>Dispatched</th><th>Status</th><th>Action</th></tr></thead><tbody>{transfers.map((transfer) => <tr key={transfer.id}><td className="font-bold">{transfer.transferNumber}</td><td>{transfer.sourceShop.name}</td><td>{transfer.items.map((item: any) => <p key={item.id} className="text-xs">{item.product.name}: {item.dispatchedQuantity || item.requestedQuantity}</p>)}</td><td>{transfer.dispatchedAt?.toLocaleString("en-KE") ?? "Not dispatched"}</td><td><Badge tone={transfer.status === "RECEIVED" ? "success" : transfer.status === "DISPATCHED" ? "warning" : "neutral"}>{transfer.status.replaceAll("_", " ")}</Badge></td><td>{transfer.status === "DISPATCHED" || transfer.status === "PARTIALLY_RECEIVED" ? <form action={receiveTransferAction}><input type="hidden" name="transferId" value={transfer.id} /><Button size="sm" variant="success"><ArrowDownToLine className="h-4 w-4" />Confirm full receipt</Button></form> : <span className="text-xs text-slate-500">No action required</span>}</td></tr>)}</tbody></table></div> : <EmptyState icon={<PackageOpen className="h-7 w-7" />} title="No incoming transfers" description="Dispatched transfers from the administrator will appear here." />}</Card></>;
}
