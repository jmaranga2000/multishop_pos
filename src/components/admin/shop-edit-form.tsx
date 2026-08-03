"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateShopAction } from "@/actions/admin/shop-actions";

export type ShopEditFormProps = {
  shop: {
    id: string;
    name: string;
    code: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    isActive: boolean;
  };
};

export function ShopEditForm({ shop }: ShopEditFormProps) {
  const [values, setValues] = useState({
    name: shop.name,
    code: shop.code,
    email: shop.email ?? "",
    password: "",
    phone: shop.phone ?? "",
    address: shop.address ?? "",
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
    startTransition(async () => {
      try {
        await updateShopAction(formData);
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
      <input type="hidden" name="shopId" value={shop.id} />
      <Input name="name" value={values.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Shop name" required />
      <Input name="code" value={values.code} onChange={(event) => updateField("code", event.target.value)} placeholder="Unique code" required />
      <Input name="email" value={values.email} onChange={(event) => updateField("email", event.target.value)} type="email" placeholder="Login email (optional)" />
      <Input name="password" value={values.password} onChange={(event) => updateField("password", event.target.value)} type="password" placeholder="New temporary password (leave blank to keep)" />
      <Input name="phone" value={values.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="Phone (optional)" />
      <textarea
        name="address"
        value={values.address}
        onChange={(event) => updateField("address", event.target.value)}
        placeholder="Physical address"
        className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500"
      />
      <div className="flex gap-2">
        <Button className="w-full" variant={dirty ? "primary" : "secondary"} isLoading={isPending} disabled={!dirty || isPending} loadingText="Saving changes...">
          {saved ? "Saved" : "Save changes"}
        </Button>
        <Link href="/admin/shops" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
          Back
        </Link>
      </div>
    </form>
  );
}
