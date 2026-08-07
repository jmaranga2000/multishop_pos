"use client";

import { Plus } from "lucide-react";
import * as React from "react";
import { createTransferAction } from "@/actions/admin/transfer-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type TransferCreateFormProps = {
  shops: Array<{ id: string; name: string }>;
  productsByShop: Record<string, Array<{ id: string; name: string; sku: string }>>;
};

export function TransferCreateForm({ shops, productsByShop }: TransferCreateFormProps) {
  const [sourceShopId, setSourceShopId] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const productOptions = sourceShopId ? productsByShop[sourceShopId] ?? [] : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-extrabold">Create transfer</h2>
        <p className="text-sm text-slate-500">Draft first, then dispatch after verification.</p>
      </div>
      <div className="p-5">
        <form
          action={async (formData) => {
            setIsSubmitting(true);
            try {
              await createTransferAction(formData);
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="space-y-3"
        >
          <select
            name="sourceShopId"
            required
            value={sourceShopId}
            onChange={(event) => setSourceShopId(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">Source shop</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>{shop.name}</option>
            ))}
          </select>

          <select name="destinationShopId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
            <option value="">Destination shop</option>
            {shops
              .filter((shop) => shop.id !== sourceShopId)
              .map((shop) => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
          </select>

          <select name="productId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" disabled={!sourceShopId}>
            <option value="">{sourceShopId ? "Product" : "Select a source shop first"}</option>
            {productOptions.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </select>

          <Input name="quantity" type="number" min="0.01" step="0.01" placeholder="Quantity" required />
          <textarea name="note" placeholder="Transfer note (optional)" className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm" />

          <Button className="w-full" type="submit" disabled={isSubmitting || !sourceShopId} isLoading={isSubmitting} loadingText="Creating draft...">
            <Plus className="h-4 w-4" />
            Create draft transfer
          </Button>
        </form>
      </div>
    </div>
  );
}
