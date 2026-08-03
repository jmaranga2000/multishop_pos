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
};

export function SupplierEditForm({ supplier, shops }: SupplierFormProps) {
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
  });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function updateField(key: keyof typeof values, value: string) {
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
