"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createProductAction } from "@/actions/admin/product-actions";
import { ProductPricingBuilder } from "@/components/admin/product-pricing-builder";
import { ProductImageUploader } from "@/components/admin/product-image-uploader";

type ProductCreateFormProps = {
  categories: Array<{ id: string; name: string }>;
  brands: Array<{ id: string; name: string }>;
  units: Array<{ id: string; name: string; symbol: string }>;
};

export function ProductCreateForm({ categories, brands, units }: ProductCreateFormProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await createProductAction(formData);
        toast.success("Product created");
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Unable to create product.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input name="name" placeholder="Product name" required />
      <Input name="sku" placeholder="Unique SKU (auto-generated if blank)" />
      <Input name="barcode" placeholder="Barcode (auto-generated if blank)" />
      <ProductImageUploader value={imageUrl} onChange={setImageUrl} />
      <div className="flex items-center gap-2">
        <select name="categoryId" className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          <option value="">Select category</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <a href="/admin/products/categories/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">New</a>
      </div>
      <div className="flex items-center gap-2">
        <select name="brandId" className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          <option value="">Select brand</option>
          {brands.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <a href="/admin/products/brands/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">New</a>
      </div>
      <div className="flex items-center gap-2">
        <select name="unitId" className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          <option value="">Select unit</option>
          {units.map((item) => (
            <option key={item.id} value={item.id}>{item.name} ({item.symbol})</option>
          ))}
        </select>
        <a href="/admin/products/units/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">New</a>
      </div>
      <ProductPricingBuilder units={units} />
      <div className="grid grid-cols-2 gap-3">
        <Input name="defaultCostPrice" type="number" min="0" step="0.01" placeholder="Cost price" required />
        <Input name="defaultSellingPrice" type="number" min="0.01" step="0.01" placeholder="Selling price" required />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button className="w-full" isLoading={isPending} loadingText="Creating product...">
        Create product
      </Button>
    </form>
  );
}
