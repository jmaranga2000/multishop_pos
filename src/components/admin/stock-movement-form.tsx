"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type StockMovementFormProps = {
  shops: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string; sku: string; defaultCostPrice: number; defaultSellingPrice: number }>;
  action: (formData: FormData) => Promise<void>;
};

export function StockMovementForm({ shops, products, action }: StockMovementFormProps) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId],
  );

  useEffect(() => {
    if (selectedProduct) {
      setCostPrice(String(selectedProduct.defaultCostPrice));
      setSellingPrice(String(selectedProduct.defaultSellingPrice));
    } else {
      setCostPrice("");
      setSellingPrice("");
    }
  }, [selectedProduct]);

  return (
    <form action={action} className="space-y-3">
      <select name="shopId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
        <option value="">Select shop</option>
        {shops.map((shop) => (
          <option key={shop.id} value={shop.id}>
            {shop.name}
          </option>
        ))}
      </select>

      <select
        name="productId"
        required
        value={selectedProductId}
        onChange={(event) => setSelectedProductId(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
      >
        <option value="">Select product</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name} ({product.sku})
          </option>
        ))}
      </select>

      <Input name="quantity" type="number" min="1" placeholder="Quantity to add" required />

      <div className="grid grid-cols-2 gap-3">
        <Input
          name="costPrice"
          type="number"
          min="0"
          step="0.01"
          placeholder="Cost price"
          value={costPrice}
          onChange={(event) => setCostPrice(event.target.value)}
          required
        />
        <Input
          name="sellingPrice"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="Selling price"
          value={sellingPrice}
          onChange={(event) => setSellingPrice(event.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input name="reorderLevel" type="number" min="0" defaultValue="10" placeholder="Reorder level" required />
        <Input name="criticalLevel" type="number" min="0" defaultValue="5" placeholder="Critical level" required />
      </div>

      <Button className="w-full">
        Save stock movement
      </Button>
    </form>
  );
}
