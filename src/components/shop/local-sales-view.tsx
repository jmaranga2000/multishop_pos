"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { listLocalSales } from "@/services/offline/query-service";
import { useOffline } from "@/components/shop/offline-provider";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney,fromMinorUnits } from "@/lib/utils";
export function LocalSalesView(){const {shopId}=useOffline();const sales=useLiveQuery(() => listLocalSales(shopId), [shopId], [])??[];return <><PageHeading title="Device sales" description="Transactions created on this device, including those waiting for central synchronization."/><Card className="overflow-hidden">{sales.length?<div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Reference</th><th>Date</th><th>Payment</th><th>Total</th><th>Status</th></tr></thead><tbody>{sales.map(s=><tr key={s.localId}><td className="font-mono text-xs">{s.receiptNumber??s.localId}</td><td>{new Date(s.occurredAt).toLocaleString()}</td><td>{s.paymentMethod}</td><td className="font-black">{formatMoney(fromMinorUnits(s.totalMinor))}</td><td><Badge tone={s.status==="SYNCED"?"success":s.status==="CONFLICT"?"danger":"warning"}>{s.status.replaceAll("_"," ")}</Badge></td></tr>)}</tbody></table></div>:<EmptyState title="No sales on this device" description="Completed POS transactions will appear here."/>}</Card></>}
