"use client";

import { MoreVertical, AlertCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateCounterAction, deactivateCounterAction } from "@/actions/admin/counter-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type CounterCardProps = {
  counter: {
    id: string;
    name: string;
    code: string;
    description?: string | null;
    deviceId?: string | null;
    status: "ACTIVE" | "INACTIVE";
    registerName?: string | null;
    currentSession?: { salesperson: string; register: string } | null;
  };
};

export function CounterCard({ counter }: CounterCardProps) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateCounterAction(counter.id, {
        name: String(form.get("name") ?? "").trim(),
        code: String(form.get("code") ?? "").trim().toUpperCase(),
        description: String(form.get("description") ?? "").trim(),
        deviceId: String(form.get("deviceId") ?? "").trim(),
        status: counter.status,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Counter updated");
      setEditing(false);
      setMenuOpen(false);
      window.location.reload();
    });
  }

  function deactivate() {
    startTransition(async () => {
      const result = counter.status === "ACTIVE"
        ? await deactivateCounterAction(counter.id)
        : await updateCounterAction(counter.id, { status: "ACTIVE" });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(counter.status === "ACTIVE" ? "Counter deactivated" : "Counter activated");
      setMenuOpen(false);
      window.location.reload();
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      {editing ? (
        <form onSubmit={save} className="space-y-3">
          <Input name="name" defaultValue={counter.name} placeholder="Counter name" required />
          <Input name="code" defaultValue={counter.code} placeholder="Counter code" required />
          <Input name="deviceId" defaultValue={counter.deviceId ?? ""} placeholder="Device ID" />
          <Input name="description" defaultValue={counter.description ?? ""} placeholder="Description" />
          <div className="flex gap-2">
            <Button size="sm" type="submit" isLoading={pending} disabled={pending}>Save</Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-bold">{counter.name}</h4>
              <p className="text-sm text-slate-500">Code: {counter.code}</p>
              {counter.registerName && <p className="text-xs text-slate-500">Register: {counter.registerName}</p>}
              {counter.description && <p className="mt-2 text-xs text-slate-600">{counter.description}</p>}
            </div>
            <Badge tone={counter.status === "ACTIVE" ? "success" : "neutral"}>{counter.status}</Badge>
          </div>
          {counter.deviceId && <p className="mt-3 rounded-lg bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">Device: {counter.deviceId}</p>}
          {counter.currentSession && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2">
              <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-600" /><div className="text-xs"><p className="font-medium text-amber-900">Session active</p><p className="text-amber-800">{counter.currentSession.salesperson} on {counter.currentSession.register}</p></div></div>
            </div>
          )}
          <div className="relative mt-4 flex items-center gap-2 border-t border-slate-200 pt-3">
            <Button type="button" size="sm" variant="ghost" className="flex-1" onClick={() => setEditing(true)}>Edit</Button>
            <Button type="button" size="sm" variant="ghost" className="px-2" aria-label="More counter actions" onClick={() => setMenuOpen((open) => !open)}><MoreVertical className="h-4 w-4" /></Button>
            {menuOpen && <div className="absolute right-0 top-12 z-10 min-w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"><button type="button" className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={deactivate} disabled={pending}>{counter.status === "ACTIVE" ? "Deactivate" : "Activate"}</button></div>}
          </div>
        </>
      )}
    </div>
  );
}