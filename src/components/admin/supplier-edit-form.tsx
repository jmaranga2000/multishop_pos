"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createSupplierAction, updateSupplierAction, deleteSupplierAction } from "@/actions/admin/supplier-actions";

type ShopOption = {
  id: string;
  name: string;
};

type ProductOption = {
  id: string;
  name: string;
  sku?: string | null;
};

type SupplierFormProps = {
  supplier?: {
    id: string;
    name: string;
    company: string;
    email: string;
    phone: string;
    alternativePhone?: string | null;
    address?: string | null;
    notes?: string | null;
    status: string;
    shopId: string;
  };
  shops: ShopOption[];
  products?: ProductOption[];
  selectedProductIds?: string[];
};

export function SupplierEditForm({ supplier, shops, products = [], selectedProductIds = [] }: SupplierFormProps) {
  const isEdit = Boolean(supplier);
  const [values, setValues] = useState({
    name: supplier?.name ?? "",
    company: supplier?.company ?? "",
    email: supplier?.email ?? "",
    phone: supplier?.phone ?? "",
    alternativePhone: supplier?.alternativePhone ?? "",
    address: supplier?.address ?? "",
    notes: supplier?.notes ?? "",
    status: supplier?.status ?? "ACTIVE",
    shopId: supplier?.shopId ?? (shops.length > 0 ? shops[0].id : ""),
    productIds: selectedProductIds,
  });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function updateField(key: keyof typeof values, value: string | string[]) {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved(false);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const action = isEdit ? updateSupplierAction : createSupplierAction;
    startTransition(async () => {
      try {
        await action(formData);
        setDirty(false);
        setSaved(true);
        toast.success(isEdit ? "Supplier updated" : "Supplier created");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {supplier && <input type="hidden" name="supplierId" value={supplier.id} />}

      <Input
        name="name"
        value={values.name}
        onChange={(event) => updateField("name", event.target.value)}
        placeholder="Supplier name"
        required
      />
      <Input
        name="company"
        value={values.company}
        onChange={(event) => updateField("company", event.target.value)}
        placeholder="Company name"
        required
      />
      <Input
        name="email"
        type="email"
        value={values.email}
        onChange={(event) => updateField("email", event.target.value)}
        placeholder="Email address"
        required
      />
      <Input
        name="phone"
        value={values.phone}
        onChange={(event) => updateField("phone", event.target.value)}
        placeholder="Phone number"
        required
      />
      <Input
        name="alternativePhone"
        value={values.alternativePhone}
        onChange={(event) => updateField("alternativePhone", event.target.value)}
        placeholder="Alternative phone (optional)"
      />

      <div>
        <label className="block text-xs font-semibold mb-2">Shop</label>
        <select
          name="shopId"
          value={values.shopId}
          onChange={(event) => updateField("shopId", event.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          required
        >
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold mb-2">Status</label>
        <select
          name="status"
          value={values.status}
          onChange={(event) => updateField("status", event.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm"
        >
          <option value="ACTIVE">Active</option>
          <option value="DISABLED">Disabled</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold mb-2">Assigned products</label>
        <div className="max-h-56 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          {products.length ? (
            <div className="space-y-2">
              {products.map((product) => {
                const checked = values.productIds.includes(product.id);
                return (
                  <label key={product.id} className="flex items-start gap-2 rounded-lg border border-transparent px-2 py-1 hover:border-slate-200 hover:bg-white">
                    <input
                      type="checkbox"
                      name="productIds"
                      value={product.id}
                      checked={checked}
                      onChange={(event) => {
                        const nextIds = event.target.checked
                          ? [...values.productIds, product.id]
                          : values.productIds.filter((id) => id !== product.id);
                        updateField("productIds", nextIds);
                      }}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium text-slate-800">{product.name}</span>
                      {product.sku ? <span className="block text-xs text-slate-500">SKU {product.sku}</span> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No products are available for this business yet.</p>
          )}
        </div>
      </div>

      <Input
        name="address"
        value={values.address}
        onChange={(event) => updateField("address", event.target.value)}
        placeholder="Business address (optional)"
      />

      <textarea
        name="notes"
        value={values.notes}
        onChange={(event) => updateField("notes", event.target.value)}
        placeholder="Additional notes (optional)"
        className="w-full px-3 py-2 border rounded-lg text-sm"
        rows={3}
      />

      <div className="flex gap-2">
        <Button type="submit" disabled={!dirty || isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
        {supplier && (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const formData = new FormData();
                formData.set("supplierId", supplier.id);
                try {
                  await deleteSupplierAction(formData);
                  toast.success("Supplier deleted");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Unable to delete");
                }
              });
            }}
          >
            Delete
          </Button>
        )}
      </div>

      {saved && <Badge tone="success">Changes saved</Badge>}
    </form>
  );
}
