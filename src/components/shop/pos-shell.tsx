"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Banknote, CreditCard, Minus, PackageX, Plus, Search, ShoppingCart, Trash2, WifiOff } from "lucide-react";
import { MdPhoneAndroid } from "react-icons/md";
import { toast } from "sonner";
import { listLocalInventoryWithProducts } from "@/services/offline/query-service";
import { createLocalSale } from "@/services/offline/pos-service";
import { useOffline } from "@/components/shop/offline-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatMoney, fromMinorUnits, getStockStatus } from "@/lib/utils";

type PricingOption = {
  unitId?: string | null;
  unitName?: string | null;
  unitSymbol?: string | null;
  costPriceMinor: number;
  sellingPriceMinor: number;
};

type CartLine = {
  productId: string;
  name: string;
  sku: string;
  unitId?: string | null;
  unitName?: string | null;
  unitSymbol?: string | null;
  quantity: number;
  unitPriceMinor: number;
  unitCostMinor: number;
  available: number;
};

export function PosShell() {
  const { shopId, online, pendingCount } = useOffline();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<Record<string, string>>({});
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [unitModalEntry, setUnitModalEntry] = useState<((typeof products)[number]) | null>(null);
  const [unitModalSelected, setUnitModalSelected] = useState<string | null>(null);
  const firstUnitRadioRef = useRef<HTMLInputElement | null>(null);
  const [processing, setProcessing] = useState(false);
  const [amountReceived, setAmountReceived] = useState("");

  const productQuery = useLiveQuery(() => listLocalInventoryWithProducts(shopId), [shopId], []);
  const products = useMemo(() => productQuery ?? [], [productQuery]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map((item) => item.product?.categoryName).filter(Boolean) as string[]))], [products]);
  const filtered = useMemo(() => products.filter((entry) => {
    const product = entry.product!;
    const matches = `${product.name} ${product.sku} ${product.barcode ?? ""}`.toLowerCase().includes(query.toLowerCase());
    return matches && (category === "All" || product.categoryName === category);
  }), [products, query, category]);
  const totalMinor = cart.reduce((sum, item) => sum + item.quantity * item.unitPriceMinor, 0);
  const receivedMinor = Math.round(Number(amountReceived || 0) * 100);

  function getPricingOption(entry: (typeof products)[number]): PricingOption {
    const product = entry.product!;
    const selectedUnitId = selectedUnits[product.id];
    if (product.pricingOptions?.length) {
      const match = product.pricingOptions.find((option) => option.unitId === selectedUnitId);
      return match ?? product.pricingOptions[0];
    }
    return {
      unitId: product.unitId ?? null,
      unitName: product.unitName ?? null,
      unitSymbol: product.unitSymbol ?? null,
      costPriceMinor: entry.costPriceMinor,
      sellingPriceMinor: entry.sellingPriceMinor,
    };
  }

  function add(entry: (typeof products)[number]) {
    const product = entry.product!;
    if (entry.projectedQuantity <= 0 || !entry.isAvailable) return toast.error(`${product.name} is out of stock`);
    // If product has multiple pricing options and no selected unit, open modal to force selection
    if (product.pricingOptions?.length && product.pricingOptions.length > 1 && !selectedUnits[product.id]) {
      setUnitModalEntry(entry);
      setUnitModalSelected(product.pricingOptions[0].unitId ?? null);
      setUnitModalOpen(true);
      return;
    }
    const pricingOption = getPricingOption(entry);
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id && item.unitId === pricingOption.unitId);
      if (existing) {
        if (existing.quantity >= entry.projectedQuantity) {
          toast.warning(`Only ${entry.projectedQuantity} units are projected to be available`);
          return current;
        }
        return current.map((item) => item.productId === product.id && item.unitId === pricingOption.unitId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitId: pricingOption.unitId,
          unitName: pricingOption.unitName,
          unitSymbol: pricingOption.unitSymbol,
          quantity: 1,
          unitPriceMinor: pricingOption.sellingPriceMinor,
          unitCostMinor: pricingOption.costPriceMinor,
          available: entry.projectedQuantity,
        },
      ];
    });
  }

  function confirmUnitSelection() {
    if (!unitModalEntry) return setUnitModalOpen(false);
    const entry = unitModalEntry;
    const product = entry.product!;
    const selectedId = unitModalSelected;
    const pricingOption = product.pricingOptions?.find((o) => o.unitId === selectedId) ?? getPricingOption(entry);
    // remember selection for future adds
    if (product.id && selectedId) setSelectedUnits((cur) => ({ ...cur, [product.id]: selectedId }));
    // add to cart using chosen pricing
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id && item.unitId === pricingOption.unitId);
      if (existing) {
        if (existing.quantity >= entry.projectedQuantity) {
          toast.warning(`Only ${entry.projectedQuantity} units are projected to be available`);
          return current;
        }
        return current.map((item) => item.productId === product.id && item.unitId === pricingOption.unitId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitId: pricingOption.unitId,
          unitName: pricingOption.unitName,
          unitSymbol: pricingOption.unitSymbol,
          quantity: 1,
          unitPriceMinor: pricingOption.sellingPriceMinor,
          unitCostMinor: pricingOption.costPriceMinor,
          available: entry.projectedQuantity,
        },
      ];
    });
    setUnitModalOpen(false);
    setUnitModalEntry(null);
  }

  function cancelUnitSelection() {
    setUnitModalOpen(false);
    setUnitModalEntry(null);
    setUnitModalSelected(null);
  }

  // Accessibility: focus first radio when modal opens, close on Escape
  useEffect(() => {
    if (unitModalOpen) {
      setTimeout(() => {
        firstUnitRadioRef.current?.focus();
      }, 0);
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") cancelUnitSelection();
      }
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [unitModalOpen]);

  function changeQuantity(productId: string, unitId: string | null | undefined, delta: number) {
    setCart((current) => current.flatMap((item) => {
      if (item.productId !== productId || item.unitId !== unitId) return [item];
      const quantity = item.quantity + delta;
      if (quantity <= 0) return [];
      if (quantity > item.available) {
        toast.warning(`Only ${item.available} units are projected to be available`);
        return [item];
      }
      return [{ ...item, quantity }];
    }));
  }

  async function checkout() {
    if (!cart.length) return;
    if (receivedMinor < totalMinor) return toast.error("Amount received is lower than the sale total");
    setProcessing(true);
    try {
      const sale = await createLocalSale({
        shopId,
        paymentMethod: "CASH",
        amountPaidMinor: receivedMinor,
        items: cart.map((item) => ({
          productId: item.productId,
          productName: item.name,
          sku: item.sku,
          unitId: item.unitId,
          unitName: item.unitName,
          unitSymbol: item.unitSymbol,
          quantity: item.quantity,
          unitPriceMinor: item.unitPriceMinor,
          unitCostMinor: item.unitCostMinor,
        })),
      });
      setCart([]);
      setAmountReceived("");
      toast.success(online ? "Sale completed and submitted for synchronization" : "Offline sale saved", { description: `Local reference: ${sale.localId.slice(0, 8).toUpperCase()}` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete sale");
    } finally {
      setProcessing(false);
    }
  }

  return <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-black">Point of sale</h1><p className="text-sm text-slate-500">{online ? "Connected to the central system" : "Using the latest synchronized shop snapshot"}</p></div>{!online && <Badge tone="warning"><WifiOff className="mr-1 h-3.5 w-3.5" />Offline cash sales only</Badge>}</div>
    <div className="pos-layout">
      <section className="min-w-0">
        <Card className="mb-4 p-4"><div className="relative"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product, SKU or scan barcode" className="pl-10" /></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${category === item ? "bg-[#173b89] text-white" : "bg-slate-100 text-slate-600"}`}>{item}</button>)}</div></Card>
        {filtered.length ? <div className="product-grid">{filtered.map((entry) => {
          const product = entry.product!;
          const status = getStockStatus(entry.projectedQuantity, entry.reorderLevel, entry.criticalLevel);
          const pricingOption = getPricingOption(entry);
          return <div key={`${entry.id}-${pricingOption.unitId ?? "default"}`} className="product-card surface rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 font-black text-blue-700">{product.name.slice(0, 2).toUpperCase()}</div>
              <Badge tone={status === "IN_STOCK" ? "success" : status === "LOW_STOCK" ? "warning" : "danger"}>{entry.projectedQuantity} left</Badge>
            </div>
            <p className="mt-3 line-clamp-2 font-bold text-slate-900">{product.name}</p>
            <p className="mt-1 text-xs text-slate-500">{product.sku}</p>
            <p className="mt-3 text-lg font-black text-[#173b89]">
              {formatMoney(fromMinorUnits(pricingOption.sellingPriceMinor))}
              {pricingOption.unitSymbol ? ` / ${pricingOption.unitSymbol}` : ""}
            </p>
            {product.pricingOptions?.length ? (
              <div className="mt-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Unit</label>
                <select
                  value={selectedUnits[product.id] ?? pricingOption.unitId ?? ""}
                  onChange={(e) => setSelectedUnits((current) => ({ ...current, [product.id]: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {product.pricingOptions.map((option) => (
                    <option key={option.unitId ?? "default"} value={option.unitId ?? ""}>
                      {option.unitName ?? option.unitSymbol ?? "Unit"} — {formatMoney(fromMinorUnits(option.sellingPriceMinor))}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <button onClick={() => add(entry)} disabled={entry.projectedQuantity <= 0} className="mt-4 w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Add</button>
          </div>;
        })}</div> : <Card className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><PackageX className="h-10 w-10 text-slate-300"/><p className="mt-3 font-bold">No products found</p><p className="mt-1 text-sm text-slate-500">Synchronize online or adjust your search.</p></Card>}
      </section>
      <Card className="cart-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 p-5"><div className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-blue-700"/><p className="font-black">Current sale</p></div><Badge>{cart.reduce((sum,item)=>sum+item.quantity,0)} items</Badge></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{cart.length ? <div className="space-y-3">{cart.map((item) => <div key={`${item.productId}-${item.unitId ?? "default"}`} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{item.name}</p><p className="text-xs text-slate-500">{(item.unitName ?? item.unitSymbol) ? `${item.unitName ?? item.unitSymbol} • ` : ""}{formatMoney(fromMinorUnits(item.unitPriceMinor))} each</p></div><button onClick={() => setCart((current) => current.filter((line) => line.productId !== item.productId || line.unitId !== item.unitId))}><Trash2 className="h-4 w-4 text-red-500"/></button></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center gap-2"><button className="rounded-lg border p-1" onClick={() => changeQuantity(item.productId, item.unitId, -1)}><Minus className="h-4 w-4"/></button><span className="w-7 text-center text-sm font-bold">{item.quantity}</span><button className="rounded-lg border p-1" onClick={() => changeQuantity(item.productId, item.unitId, 1)}><Plus className="h-4 w-4"/></button></div><p className="font-black">{formatMoney(fromMinorUnits(item.quantity * item.unitPriceMinor))}</p></div></div>)}</div> : <div className="flex h-full min-h-52 flex-col items-center justify-center text-center"><ShoppingCart className="h-10 w-10 text-slate-200"/><p className="mt-3 font-bold text-slate-700">Your cart is empty</p><p className="mt-1 text-sm text-slate-400">Select a product to begin.</p></div>}</div>
        <div className="border-t border-slate-200 bg-slate-50 p-4"><div className="mb-3 flex items-center justify-between"><span className="text-sm text-slate-500">Total</span><span className="text-2xl font-black">{formatMoney(fromMinorUnits(totalMinor))}</span></div><label className="mb-1 block text-xs font-bold text-slate-600">Cash received</label><Input type="number" min="0" step="0.01" value={amountReceived} onChange={(e)=>setAmountReceived(e.target.value)} placeholder="0.00" />
          <div className="mt-3 grid grid-cols-3 gap-2"><button className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-bold text-emerald-700"><Banknote className="mx-auto mb-1 h-5 w-5"/>Cash</button><button disabled={!online} title="Requires online payment integration" className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-400 disabled:opacity-50"><MdPhoneAndroid className="mx-auto mb-1 h-5 w-5"/>M-Pesa</button><button disabled={!online} title="Requires online payment integration" className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-400 disabled:opacity-50"><CreditCard className="mx-auto mb-1 h-5 w-5"/>Card</button></div>
          <Button onClick={() => void checkout()} disabled={!cart.length || processing} className="mt-3 w-full" size="lg"><Banknote className="h-5 w-5"/>{processing ? "Completing sale..." : `Complete cash sale${pendingCount ? ` • ${pendingCount} pending` : ""}`}</Button>
        </div>
      </Card>
    </div>
    {unitModalOpen && unitModalEntry ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="unit-modal-title" aria-describedby="unit-modal-description">
        <div className="absolute inset-0 bg-black opacity-40" onClick={cancelUnitSelection} />
        <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <h3 id="unit-modal-title" className="text-lg font-bold">Pick unit for {unitModalEntry.product!.name}</h3>
          <p id="unit-modal-description" className="mt-1 text-sm text-slate-500">Select the unit to use for this sale line.</p>
          <div className="mt-4 space-y-3">
            {unitModalEntry.product!.pricingOptions?.map((opt, i) => (
              <label key={opt.unitId ?? "default"} className="flex items-center gap-3 rounded-lg border p-3 hover:border-slate-300 focus-within:border-blue-500">
                <input ref={i === 0 ? firstUnitRadioRef : undefined} type="radio" name="unitPick" checked={unitModalSelected === (opt.unitId ?? null)} onChange={() => setUnitModalSelected(opt.unitId ?? null)} />
                <div>
                  <div className="font-semibold">{opt.unitName ?? opt.unitSymbol ?? "Unit"}</div>
                  <div className="text-xs text-slate-500">{formatMoney(fromMinorUnits(opt.sellingPriceMinor))}{opt.unitSymbol ? ` / ${opt.unitSymbol}` : ''}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={cancelUnitSelection}>Cancel</Button>
            <Button type="button" onClick={() => confirmUnitSelection()}>Add with selected unit</Button>
          </div>
        </div>
      </div>
    ) : null}
  </div>;
}
