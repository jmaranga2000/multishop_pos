"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateSalespersonAction } from "@/actions/admin/salesperson-actions";

export type SalespersonEditFormProps = {
  salesperson: {
    id: string;
    name: string;
    code: string;
    shopName?: string | null;
  };
};

export function SalespersonEditForm({ salesperson }: SalespersonEditFormProps) {
  const [values, setValues] = useState({
    name: salesperson.name,
    code: salesperson.code,
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
        await updateSalespersonAction(formData);
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
      <input type="hidden" name="salespersonId" value={salesperson.id} />
      <Input name="name" value={values.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Full name" required />
      <Input name="code" value={values.code} onChange={(event) => updateField("code", event.target.value)} placeholder="Short code" required />
      <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
        Shop: {salesperson.shopName ?? "Unknown shop"}
      </div>
      <div className="flex gap-2">
        <Button className="w-full" variant={dirty ? "primary" : "secondary"} disabled={!dirty || isPending}>
          {saved ? "Saved" : isPending ? "Saving..." : "Save changes"}
        </Button>
        <Link href="/admin/salespeople" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
          Back
        </Link>
      </div>
    </form>
  );
}
