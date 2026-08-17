"use client";

import { type FormEvent, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormActionResult = void | { success?: boolean; error?: string };
type FormAction = (formData: FormData) => FormActionResult | Promise<FormActionResult>;
type Product = { id: string; name: string; sku?: string | null; unitId?: string | null; defaultCostPrice?: number };
type Supplier = { id: string; name: string; shopId: string };
type Shop = { id: string; name: string };

export function RequisitionForm({ action, shops, suppliers, products, fixedShopId }: { action: FormAction; shops?: Shop[]; suppliers: Supplier[]; products: Product[]; fixedShopId?: string }) {
  const [shopId, setShopId] = useState(fixedShopId ?? shops?.[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [items, setItems] = useState<Array<{ productId: string; requestedQuantity: number }>>([]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const addItem = () => {
    const requestedQuantity = Number(quantity);
    if (!productId || requestedQuantity <= 0 || items.some((item) => item.productId === productId)) return;
    setItems((current) => [...current, { productId, requestedQuantity }]); setProductId(""); setQuantity("1");
  };
  return <form action={action} className="space-y-3">
    {fixedShopId ? <input type="hidden" name="shopId" value={fixedShopId} /> : <label className="grid gap-1 text-sm font-medium">Shop<select name="shopId" value={shopId} onChange={(event) => { setShopId(event.target.value); setSupplierId(""); }} className="rounded-lg border bg-white px-3 py-2" required><option value="">Select shop</option>{shops?.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label>}
    <label className="grid gap-1 text-sm font-medium">Supplier <span className="font-normal text-slate-500">(optional)</span><select name="supplierId" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="rounded-lg border bg-white px-3 py-2"><option value="">Choose later</option>{suppliers.filter((supplier) => !shopId || supplier.shopId === shopId).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
    <label className="grid gap-1 text-sm font-medium">Reason<Input name="reason" maxLength={1000} placeholder="Why this stock is needed" /></label>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_96px] lg:grid-cols-[minmax(0,1fr)_110px_auto]"><select value={productId} onChange={(event) => setProductId(event.target.value)} className="min-w-0 rounded-lg border bg-white px-3 py-2"><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} {product.sku ? `(${product.sku})` : ""}</option>)}</select><Input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} /><Button type="button" variant="secondary" className="w-full sm:col-span-2 lg:col-span-1 lg:w-auto" onClick={addItem}>Add item</Button></div>
    {items.length ? <div className="rounded-lg border bg-slate-50 p-3 text-sm">{items.map((item) => <div key={item.productId} className="flex justify-between gap-2 py-1"><span>{productById.get(item.productId)?.name ?? "Product"} × {item.requestedQuantity}</span><button type="button" onClick={() => setItems((current) => current.filter((entry) => entry.productId !== item.productId))} className="text-red-600">Remove</button></div>)}</div> : <p className="text-xs text-slate-500">Add one or more products before submitting.</p>}
    <input type="hidden" name="itemsJson" value={JSON.stringify(items)} /><Button disabled={!shopId || !items.length}>Submit requisition</Button>
  </form>;
}

type PurchaseOrderRequisition = {
  id: string;
  requisitionNumber: string;
  shopId: string;
  supplierId?: string | null;
  items: Array<{ id: string; productId: string; unitId?: string | null; requestedQuantity: number }>;
};

type PurchaseOrderLine = {
  requisitionItemId?: string;
  productId: string;
  unitId?: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
};

export function PurchaseOrderForm({ action, shops, suppliers, products, requisitions = [] }: { action: FormAction; shops: Shop[]; suppliers: Supplier[]; products: Product[]; requisitions?: PurchaseOrderRequisition[] }) {
  const [shopId, setShopId] = useState(shops[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [requisitionId, setRequisitionId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [items, setItems] = useState<PurchaseOrderLine[]>([]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const clearRequisitionConversion = () => {
    setRequisitionId("");
    setItems([]);
  };

  const selectRequisition = (nextRequisitionId: string) => {
    setRequisitionId(nextRequisitionId);
    if (!nextRequisitionId) {
      setItems([]);
      return;
    }
    const requisition = requisitions.find((entry) => entry.id === nextRequisitionId);
    if (!requisition) return;
    setShopId(requisition.shopId);
    setSupplierId(requisition.supplierId ?? "");
    setItems(requisition.items.map((item) => {
      const product = productById.get(item.productId);
      return {
        requisitionItemId: item.id,
        productId: item.productId,
        unitId: item.unitId ?? product?.unitId ?? undefined,
        quantity: item.requestedQuantity,
        unitCost: product?.defaultCostPrice ?? 0,
        taxRate: 0,
      };
    }));
  };

  const addItem = () => {
    const parsedQuantity = Number(quantity);
    const parsedCost = Number(unitCost);
    const parsedTax = Number(taxRate);
    const product = productById.get(productId);
    if (!productId || !product || parsedQuantity <= 0 || parsedCost < 0 || parsedTax < 0 || parsedTax > 100 || items.some((item) => item.productId === productId)) return;
    setItems((current) => [...current, { productId, unitId: product.unitId ?? undefined, quantity: parsedQuantity, unitCost: parsedCost, taxRate: parsedTax }]);
    setProductId("");
    setQuantity("1");
    setUnitCost("0");
    setTaxRate("0");
  };

  return <form action={action} className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm font-medium">Shop
        <select name="shopId" value={shopId} onChange={(event) => { setShopId(event.target.value); setSupplierId(""); clearRequisitionConversion(); }} className="rounded-lg border bg-white px-3 py-2" required>
          <option value="">Select shop</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">Supplier
        <select name="supplierId" value={supplierId} onChange={(event) => { setSupplierId(event.target.value); if (requisitionId) clearRequisitionConversion(); }} className="rounded-lg border bg-white px-3 py-2" required>
          <option value="">Select supplier</option>{suppliers.filter((supplier) => supplier.shopId === shopId).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </select>
      </label>
    </div>
    <label className="grid gap-1 text-sm font-medium">Approved requisition <span className="font-normal text-slate-500">(optional conversion)</span>
      <select name="requisitionId" value={requisitionId} onChange={(event) => selectRequisition(event.target.value)} className="rounded-lg border bg-white px-3 py-2">
        <option value="">Create standalone order</option>{requisitions.map((request) => <option key={request.id} value={request.id}>{request.requisitionNumber}</option>)}
      </select>
    </label>
    {requisitionId ? <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">The approved request’s products are locked into this order. Select “Create standalone order” to build a different order.</p> : null}
    <label className="grid gap-1 text-sm font-medium">Expected delivery<Input name="expectedDeliveryDate" type="date" /></label>
    <div className="grid gap-2 lg:grid-cols-[1fr_100px_110px_90px_auto]">
      <select value={productId} onChange={(event) => { setProductId(event.target.value); setUnitCost(String(productById.get(event.target.value)?.defaultCostPrice ?? 0)); }} className="rounded-lg border bg-white px-3 py-2" disabled={Boolean(requisitionId)}>
        <option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
      </select>
      <Input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Qty" disabled={Boolean(requisitionId)} />
      <Input type="number" min="0" step="0.01" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} placeholder="Cost" disabled={Boolean(requisitionId)} />
      <Input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} placeholder="VAT %" disabled={Boolean(requisitionId)} />
      <Button type="button" variant="secondary" onClick={addItem} disabled={Boolean(requisitionId)}>Add</Button>
    </div>
    {items.length ? <div className="rounded-lg border bg-slate-50 p-3 text-sm">{items.map((item) => <div key={item.productId} className="flex justify-between gap-2 py-1"><span>{productById.get(item.productId)?.name ?? "Product"} × {item.quantity} @ KES {item.unitCost.toFixed(2)} + {item.taxRate}% VAT</span>{requisitionId ? <span className="text-xs text-slate-500">Requested line</span> : <button type="button" onClick={() => setItems((current) => current.filter((entry) => entry.productId !== item.productId))} className="text-red-600">Remove</button>}</div>)}</div> : <p className="text-xs text-slate-500">Build the order from one or more product lines.</p>}
    <input type="hidden" name="itemsJson" value={JSON.stringify(items)} />
    <label className="grid gap-1 text-sm font-medium">Notes<Input name="notes" maxLength={1000} /></label>
    <Button disabled={!shopId || !supplierId || !items.length}>Create draft purchase order</Button>
  </form>;
}

type ReceiptOrder = { id: string; items: Array<{ id: string; productName: string; orderedQuantity: number; receivedQuantity: number }> };
export function GoodsReceiptForm({ action, order }: { action: FormAction; order: ReceiptOrder }) {
  const [lines, setLines] = useState(order.items.map((item) => ({ purchaseOrderItemId: item.id, receivedQuantity: "", damagedQuantity: "0", rejectedQuantity: "0", rejectionReason: "" })));
  const idempotencyKeyRef = useRef<HTMLInputElement>(null);
  const items = lines.flatMap((line) => { const receivedQuantity = Number(line.receivedQuantity); return receivedQuantity > 0 ? [{ purchaseOrderItemId: line.purchaseOrderItemId, receivedQuantity, damagedQuantity: Number(line.damagedQuantity) || 0, rejectedQuantity: Number(line.rejectedQuantity) || 0, rejectionReason: line.rejectionReason || undefined }] : []; });
  return <form action={action} className="space-y-2" onSubmit={() => { const input = idempotencyKeyRef.current; if (input && !input.value) input.value = globalThis.crypto?.randomUUID?.() ?? "00000000-0000-4000-8000-000000000000"; }}><input type="hidden" name="purchaseOrderId" value={order.id} /><input ref={idempotencyKeyRef} type="hidden" name="idempotencyKey" defaultValue="" />{order.items.map((item, index) => <div key={item.id} className="grid gap-2 rounded-lg border p-3 lg:grid-cols-[1fr_100px_100px_100px_1fr]"><div><p className="font-medium">{item.productName}</p><p className="text-xs text-slate-500">Ordered {item.orderedQuantity}; received {item.receivedQuantity}</p></div><Input type="number" min="0" step="0.01" placeholder="Received" value={lines[index].receivedQuantity} onChange={(event) => setLines((current) => current.map((line, i) => i === index ? { ...line, receivedQuantity: event.target.value } : line))} /><Input type="number" min="0" step="0.01" placeholder="Damaged" value={lines[index].damagedQuantity} onChange={(event) => setLines((current) => current.map((line, i) => i === index ? { ...line, damagedQuantity: event.target.value } : line))} /><Input type="number" min="0" step="0.01" placeholder="Rejected" value={lines[index].rejectedQuantity} onChange={(event) => setLines((current) => current.map((line, i) => i === index ? { ...line, rejectedQuantity: event.target.value } : line))} /><Input placeholder="Rejection reason" value={lines[index].rejectionReason} onChange={(event) => setLines((current) => current.map((line, i) => i === index ? { ...line, rejectionReason: event.target.value } : line))} /></div>)}<input type="hidden" name="itemsJson" value={JSON.stringify(items)} /><label className="grid gap-1 text-sm font-medium">Receipt notes<Input name="notes" maxLength={1000} /></label><Button disabled={!items.length}>Finalize goods receipt</Button></form>;
}

type StocktakeItem = { id: string; productName: string; sku: string; barcode?: string | null; systemQuantity: number; physicalQuantity?: number | null; varianceReason?: string | null; reasonNote?: string | null };
export function StocktakeCountForm({ action, stocktakeId, item }: { action: FormAction; stocktakeId: string; item: StocktakeItem }) {
  const [physicalQuantity, setPhysicalQuantity] = useState(item.physicalQuantity?.toString() ?? "");
  const [varianceReason, setVarianceReason] = useState(item.varianceReason ?? "");
  const [reasonNote, setReasonNote] = useState(item.reasonNote ?? "");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const quantity = Number(physicalQuantity);
  const items = Number.isFinite(quantity) && physicalQuantity !== "" ? [{ stocktakeItemId: item.id, physicalQuantity: quantity, varianceReason: varianceReason || undefined, reasonNote: reasonNote || undefined }] : [];
  const significantVariance = items.length > 0 && Math.abs(quantity - item.systemQuantity) >= Math.max(1, Math.abs(item.systemQuantity) * 0.05);

  function saveCount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!items.length) return;
    if (significantVariance && !varianceReason) {
      setError("This count has a significant variance. Select a variance reason before saving.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await action(formData);
      if (result && result.error) setError(result.error);
    });
  }

  return <form onSubmit={saveCount} data-stocktake-barcode={item.barcode ?? ""} className="grid items-end gap-2 border-t py-3 md:grid-cols-[1fr_120px_180px_1fr_auto]"><div><p className="font-medium">{item.productName}</p><p className="text-xs text-slate-500">{item.sku} · System snapshot: {item.systemQuantity}</p></div><Input id={`stocktake-count-${item.id}`} type="number" min="0" step="0.01" value={physicalQuantity} onChange={(event) => setPhysicalQuantity(event.target.value)} placeholder="Count" disabled={isPending} /><select value={varianceReason} onChange={(event) => setVarianceReason(event.target.value)} disabled={isPending} className="rounded-lg border bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"><option value="">Variance reason</option>{["DAMAGED_GOODS", "EXPIRED_GOODS", "THEFT_LOSS", "UNRECORDED_SALE", "RECEIVING_ERROR", "TRANSFER_ERROR", "COUNTING_ERROR", "DATA_ENTRY_ERROR", "OTHER"].map((reason) => <option key={reason} value={reason}>{reason.replaceAll("_", " ")}</option>)}</select><Input value={reasonNote} onChange={(event) => setReasonNote(event.target.value)} placeholder="Reason note" disabled={isPending} /><input type="hidden" name="stocktakeId" value={stocktakeId} /><input type="hidden" name="itemsJson" value={JSON.stringify(items)} /><Button type="submit" size="sm" variant="secondary" disabled={!items.length || isPending} isLoading={isPending} loadingText="Saving...">Save count</Button>{error ? <p className="text-sm text-red-700 md:col-span-5">{error}</p> : null}</form>;
}export function StocktakeBarcodeLookup() {
  const [barcode, setBarcode] = useState("");
  const [message, setMessage] = useState("");
  const focusProduct = () => {
    const normalized = barcode.trim().toLowerCase();
    if (!normalized) return;
    const target = [...document.querySelectorAll<HTMLFormElement>("form[data-stocktake-barcode]")].find((form) => form.dataset.stocktakeBarcode?.trim().toLowerCase() === normalized);
    if (!target) { setMessage("No active stocktake line matches that barcode."); return; }
    (target.querySelector('input[type="number"]') as HTMLInputElement | null)?.focus();
    target.scrollIntoView({ behavior: "smooth", block: "center" }); setMessage("Product found. Enter its physical count."); setBarcode("");
  };
  return <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3"><label className="mb-1 block text-sm font-semibold text-slate-800">Barcode lookup</label><div className="flex gap-2"><Input value={barcode} onChange={(event) => setBarcode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); focusProduct(); } }} placeholder="Scan barcode or type code, then press Enter" autoComplete="off" /><Button type="button" variant="secondary" onClick={focusProduct}>Find product</Button></div>{message ? <p className="mt-2 text-xs text-slate-600">{message}</p> : null}</div>;
}