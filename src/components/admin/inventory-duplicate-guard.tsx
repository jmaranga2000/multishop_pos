"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  shops: { id: string; name: string }[];
  products: { id: string; name: string }[];
  item: { id: string; shopId: string; productId: string; quantity?: number; isAvailable?: boolean };
  inventory: Array<{ id: string; shopId: string; productId: string }>;
};

export function InventoryDuplicateGuard({ shops, products, item, inventory }: Props) {
  const [shopId, setShopId] = useState(item.shopId);
  const [productId, setProductId] = useState(item.productId);
  const [duplicate, setDuplicate] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const prev = useRef({ shopId: item.shopId, productId: item.productId });

  useEffect(() => {
    const found = inventory.some((inv) => inv.shopId === shopId && inv.productId === productId && inv.id !== item.id);
    setDuplicate(found);
    // disable/enable the save button outside the client component
    const btn = document.getElementById("inventory-save-btn") as HTMLButtonElement | null;
    if (btn) btn.disabled = found && !confirm;
  }, [shopId, productId, inventory, confirm, item.id]);

  function undo() {
    setShopId(prev.current.shopId);
    setProductId(prev.current.productId);
    setConfirm(false);
  }

  return (
    <>
      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Product</p>
        <select name="productId" value={productId} onChange={(e) => { setProductId(e.target.value); }} className="mt-1 w-full rounded-md border px-2 py-2 text-sm">
          {products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
      </div>
      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Shop</p>
        <select name="shopId" value={shopId} onChange={(e) => { setShopId(e.target.value); }} className="mt-1 w-full rounded-md border px-2 py-2 text-sm">
          {shops.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </select>
      </div>

      {duplicate ? (
        <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="font-semibold text-amber-800">Warning: an inventory record already exists for this shop & product.</p>
          <p className="text-sm text-amber-700">Changing to this shop/product will create a duplicated pairing. Choose Undo to revert or check confirm to allow saving.</p>
          <div className="mt-2 flex items-center gap-3">
            <label className="inline-flex items-center gap-2"><input type="checkbox" name="confirmDuplicate" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> <span className="text-sm">I understand and want to proceed</span></label>
            <Button variant="ghost" onClick={undo}>Undo</Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default InventoryDuplicateGuard;
