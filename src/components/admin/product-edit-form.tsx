"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProductAction } from "@/actions/admin/product-actions";
import { ProductPricingBuilder } from "@/components/admin/product-pricing-builder";
import { ProductImageUploader } from "@/components/admin/product-image-uploader";

export type ProductEditFormProps = {
  product: {
    id: string;
    name: string;
    sku: string;
    barcode?: string | null;
    imageUrl?: string | null;
    categoryId?: string | null;
    brandId?: string | null;
    unitId?: string | null;
    defaultCostPrice: number;
    defaultSellingPrice: number;
    status: string;
    pricingUnits?: Array<{ unitId: string; costPrice: number; sellingPrice: number }>;
  };
  categories: Array<{ id: string; name: string }>;
  brands: Array<{ id: string; name: string }>;
  units: Array<{ id: string; name: string; symbol: string }>;
};

export function ProductEditForm({ product, categories, brands, units }: ProductEditFormProps) {
  const [values, setValues] = useState({
    name: product.name,
    sku: product.sku,
    barcode: product.barcode ?? "",
    imageUrl: product.imageUrl ?? "",
    categoryId: product.categoryId ?? "",
    brandId: product.brandId ?? "",
    unitId: product.unitId ?? "",
    defaultCostPrice: product.defaultCostPrice.toString(),
    defaultSellingPrice: product.defaultSellingPrice.toString(),
  });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const pricingInitialRows = useMemo(() => {
    if (product.pricingUnits?.length) {
      return product.pricingUnits.map((entry) => ({
        unitId: entry.unitId,
        costPrice: entry.costPrice,
        sellingPrice: entry.sellingPrice,
        multiplier: (entry as any).multiplier ?? 1,
      }));
    }
    return [
      {
        unitId: product.unitId ?? "",
        costPrice: product.defaultCostPrice,
        sellingPrice: product.defaultSellingPrice,
      },
    ];
  }, [product.pricingUnits, product.unitId, product.defaultCostPrice, product.defaultSellingPrice]);

  function updateField(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved(false);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await updateProductAction(formData);
        setDirty(false);
        setSaved(true);
        toast.success("Changes saved");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save changes");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="productId" value={product.id} />
      <Input name="name" value={values.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Product name" required />
      <Input name="sku" value={values.sku} onChange={(event) => updateField("sku", event.target.value)} placeholder="SKU" required />
      <Input name="barcode" value={values.barcode} onChange={(event) => updateField("barcode", event.target.value)} placeholder="Barcode (optional)" />
      <ProductImageUploader value={values.imageUrl} onChange={(value) => updateField("imageUrl", value)} />
      <div className="flex items-center gap-2">
        <select name="categoryId" value={values.categoryId} onChange={(event) => updateField("categoryId", event.target.value)} className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm">
        <option value="">Select category</option>
        {categories.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
        </select>
        <a href="/admin/products/categories/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">New</a>
      </div>
      <div className="flex items-center gap-2">
        <select name="brandId" value={values.brandId} onChange={(event) => updateField("brandId", event.target.value)} className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm">
        <option value="">Select brand</option>
        {brands.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
        </select>
        <a href="/admin/products/brands/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">New</a>
      </div>
      <div className="flex items-center gap-2">
        <select name="unitId" value={values.unitId} onChange={(event) => updateField("unitId", event.target.value)} className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm">
        <option value="">Select unit</option>
        {units.map((item) => (
          <option key={item.id} value={item.id}>{item.name} ({item.symbol})</option>
        ))}
        </select>
        <a href="/admin/products/units/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">New</a>
      </div>
      <ProductPricingBuilder units={units} initialRows={pricingInitialRows} onRowsChange={() => {
        setDirty(true);
        setSaved(false);
      }} />
      <div className="grid grid-cols-2 gap-3">
        <Input name="defaultCostPrice" value={values.defaultCostPrice} onChange={(event) => updateField("defaultCostPrice", event.target.value)} type="number" min="0" step="0.01" placeholder="Cost price" required />
        <Input name="defaultSellingPrice" value={values.defaultSellingPrice} onChange={(event) => updateField("defaultSellingPrice", event.target.value)} type="number" min="0.01" step="0.01" placeholder="Selling price" required />
      </div>
      <div className="flex gap-2">
        <Button className="w-full" variant={dirty ? "primary" : "secondary"} isLoading={isPending} disabled={!dirty || isPending} loadingText="Saving changes...">
          {saved ? "Saved" : "Save changes"}
        </Button>
        <Link href="/admin/products" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
          Back
        </Link>
      </div>
    </form>
  );
}
