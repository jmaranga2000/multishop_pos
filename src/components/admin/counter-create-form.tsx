"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCounterAction } from "@/actions/admin/counter-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CounterCreateForm({ shopId, onCreated }: { shopId: string; onCreated?: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      name: String(form.get("name") ?? "").trim(),
      code: String(form.get("code") ?? "").trim().toUpperCase(),
      description: String(form.get("description") ?? "").trim() || undefined,
      deviceId: String(form.get("deviceId") ?? "").trim() || undefined,
      pin: String(form.get("pin") ?? "").trim(),
    };

    startTransition(async () => {
      const result = await createCounterAction(shopId, input);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Counter created");
      setIsOpen(false);
      onCreated?.();
      router.refresh();
    });
  }

  if (!isOpen) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setIsOpen(true)}>
        Add counter
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="name" placeholder="Counter name" required minLength={1} maxLength={100} />
        <Input name="code" placeholder="Code, e.g. C02" required minLength={1} maxLength={20} />
        <Input name="deviceId" placeholder="Device ID (optional)" maxLength={100} />
        <Input name="description" placeholder="Description (optional)" maxLength={500} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" isLoading={isPending} disabled={isPending} loadingText="Creating...">Create counter</Button>
        <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => setIsOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
