import { RotateCcw, Search } from "lucide-react";
import { requireShop } from "@/lib/rbac";
import { createRefundRequestAction } from "@/actions/shop/refund-actions";
import { getShopRefundPageData, searchShopSalesForRefunds } from "@/services/shop/refund-service";
import { formatMoney } from "@/lib/utils";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

type RefundPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RefundRequestPage({ searchParams }: RefundPageProps) {
  const user = await requireShop();
  const resolvedSearchParams = (await searchParams) ?? {};
  const successMessage = typeof resolvedSearchParams.success === "string" ? decodeURIComponent(resolvedSearchParams.success) : "";
  const errorMessage = typeof resolvedSearchParams.error === "string" ? decodeURIComponent(resolvedSearchParams.error) : "";
  const query = {
    receiptNumber: typeof resolvedSearchParams.receiptNumber === "string" ? resolvedSearchParams.receiptNumber : "",
    saleReference: typeof resolvedSearchParams.saleReference === "string" ? resolvedSearchParams.saleReference : "",
    customerName: typeof resolvedSearchParams.customerName === "string" ? resolvedSearchParams.customerName : "",
    saleDate: typeof resolvedSearchParams.saleDate === "string" ? resolvedSearchParams.saleDate : "",
  };
  const [{ requests, business }, matchingSales] = await Promise.all([
    getShopRefundPageData(user.shopId, user.businessId),
    searchShopSalesForRefunds(user.shopId, query),
  ]);
  const selectedSaleId = typeof resolvedSearchParams.saleId === "string" ? resolvedSearchParams.saleId : "";
  const selectedSale = matchingSales.find((sale: { id: string }) => sale.id === selectedSaleId) ?? null;

  return <>
    <PageHeading title="Refund requests" description="Search completed sales, select return items, and request manager approval without changing the original sale record." />
    {successMessage ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{successMessage}</div> : null}
    {errorMessage ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <Card className="overflow-hidden">
        <CardHeader><h2 className="font-extrabold">Request history</h2></CardHeader>
        {requests.length ? <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Sale amount</th>
                <th>Requested</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td className="font-bold">{request.sale.receiptNumber}</td>
                  <td>{formatMoney(String(request.sale.total), business.currency)}</td>
                  <td>{request.requestedAt.toLocaleString("en-KE")}</td>
                  <td>{request.requestType}</td>
                  <td><Badge tone={request.status === "COMPLETED" ? "success" : request.status === "REJECTED" ? "danger" : "warning"}>{request.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> : <EmptyState title="No refund requests" description="Requests submitted from this shop will appear here." />}
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-extrabold">Find sale</h2>
              <p className="text-sm text-slate-500">Search by receipt, sale reference, customer, or date.</p>
            </div>
          </CardHeader>
          <CardContent>
            <form method="get" className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Input name="receiptNumber" defaultValue={query.receiptNumber} placeholder="Receipt number" />
                <Input name="saleReference" defaultValue={query.saleReference} placeholder="Sale reference" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input name="customerName" defaultValue={query.customerName} placeholder="Customer name" />
                <Input name="saleDate" defaultValue={query.saleDate} type="date" />
              </div>
              <Button type="submit" className="w-full"><Search className="h-4 w-4" />Search sales</Button>
            </form>

            {matchingSales.length ? <div className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">Matches</h3>
              <form action={createRefundRequestAction} className="space-y-4 border-t border-slate-200 pt-4">
                {matchingSales.map((sale: { id: string; receiptNumber: string; customerName?: string | null; occurredAt: Date | string; total: number | string }) => (
                  <label key={sale.id} className={`flex items-start justify-between rounded-xl border p-3 text-sm ${selectedSaleId === sale.id ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                    <div>
                      <p className="font-semibold text-slate-800">{sale.receiptNumber}</p>
                      <p className="text-slate-500">{sale.customerName ?? "Walk-in customer"}</p>
                      <p className="text-slate-500">{new Date(sale.occurredAt).toLocaleString("en-KE")}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatMoney(String(sale.total), business.currency)}</p>
                      <input type="radio" name="saleId" value={sale.id} defaultChecked={selectedSaleId === sale.id} />
                    </div>
                  </label>
                ))}
                <input type="hidden" name="receiptNumber" value={selectedSale?.receiptNumber ?? ""} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">Request type
                    <select name="requestType" defaultValue="FULL_SALE" className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                      <option value="FULL_SALE">Full sale</option>
                      <option value="SELECTED_PRODUCTS">Selected products</option>
                      <option value="EXCHANGE">Exchange</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700">Refund method
                    <select name="refundMethod" defaultValue="CASH" className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                      <option value="CASH">Cash</option>
                      <option value="MPESA">M-Pesa</option>
                      <option value="CARD">Card</option>
                      <option value="BANK_TRANSFER">Bank transfer</option>
                      <option value="MIXED">Mixed</option>
                    </select>
                  </label>
                </div>

                {selectedSale ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-700">Items in the selected sale</p>
                  <div className="mt-3 space-y-2">
                    {selectedSale.items.map((item: { id: string; product?: { name?: string | null } | null; productName: string; quantity: number }) => (
                      <label key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                        <span>{item.product?.name ?? item.productName} × {item.quantity}</span>
                        <input type="checkbox" name="selectedItemIds" value={item.id} />
                      </label>
                    ))}
                  </div>
                </div> : <p className="text-sm text-slate-500">Select a sale to choose which items to return.</p>}

                <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="restockReturnedProducts" defaultChecked />Restock returned products</label>
                <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="markItemsAsDamaged" />Mark returned items as damaged</label>
                <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="requestManagerApproval" />Request manager approval</label>
                <textarea name="reason" placeholder="Explain the return reason" className="min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm" required />
                <Button className="w-full"><RotateCcw className="h-4 w-4" />Submit refund request</Button>
              </form>
            </div> : <EmptyState title="No matching sales" description="Adjust the search fields to find a completed sale." />}
          </CardContent>
        </Card>
      </div>
    </div>
  </>;
}
