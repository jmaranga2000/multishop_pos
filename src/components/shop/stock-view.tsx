"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { listLocalInventoryWithProducts } from "@/services/offline/query-service";
import { useOffline } from "@/components/shop/offline-provider";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney,fromMinorUnits,getStockStatus } from "@/lib/utils";
export function StockView(){
	const {shopId,lastSyncAt}=useOffline();
	const rows = useLiveQuery(() => listLocalInventoryWithProducts(shopId), [shopId], []) ?? [];
	const categories = rows.reduce((map, r) => {
		const cat = r.product?.categoryName ?? "Uncategorized";
		if (!map.has(cat)) map.set(cat, [] as (typeof rows)[number][]);
		map.get(cat)!.push(r);
		return map;
	}, new Map<string, (typeof rows)[number][]>());

	return <>
		<PageHeading title="Shop stock" description={`Projected local availability. Last synchronized: ${lastSyncAt?new Date(lastSyncAt).toLocaleString():"never"}`} />
		<Card className="overflow-hidden">
			{rows.length ? (
				<div className="space-y-6 p-4">
					{Array.from(categories.entries()).map(([category, items]) => (
						<div key={category}>
							<h3 className="mb-2 font-bold">{category}</h3>
							<div className="overflow-x-auto">
								<table className="data-table">
									<thead>
										<tr><th>Product</th><th>SKU</th><th>Server snapshot</th><th>Projected available</th><th>Price</th><th>Status</th></tr>
									</thead>
									<tbody>
										{items.map(r => { const status = getStockStatus(r.projectedQuantity, r.reorderLevel, r.criticalLevel); return (
											<tr key={r.id}><td className="font-bold">{r.product?.name}</td><td className="font-mono text-xs">{r.product?.sku}</td><td>{r.serverQuantity}</td><td className="font-black">{r.projectedQuantity}</td><td>{formatMoney(fromMinorUnits(r.sellingPriceMinor))}</td><td><Badge tone={status==="IN_STOCK"?"success":status==="LOW_STOCK"?"warning":"danger"}>{status.replaceAll("_"," ")}</Badge></td></tr>
										)})}
									</tbody>
								</table>
							</div>
						</div>
					))}
				</div>
			) : (
				<EmptyState title="No cached stock" description="Connect to the internet and synchronize this shop." />
			)}
		</Card>
	</>;
}
