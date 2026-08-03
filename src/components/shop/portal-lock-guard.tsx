"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { unlockShopPortalAction } from "@/actions/shop/register-actions";
import { toast } from "sonner";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export function ShopPortalLockGuard({ salespersonId, salespersonName }: { salespersonId?: string | null; salespersonName?: string | null }) {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<number | null>(null);

  const resetTimer = () => {
    if (typeof window === "undefined" || !salespersonId) return;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setLocked(true);
    }, IDLE_TIMEOUT_MS);
  };

  useEffect(() => {
    if (!salespersonId) return undefined;

    const activityEvents = ["mousedown", "keydown", "touchstart", "pointerdown", "scroll", "mousemove"];
    resetTimer();

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, resetTimer, { passive: true });
    }

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, resetTimer);
      }
    };
  }, [salespersonId]);

  async function onUnlockSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!salespersonId) return;

    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = await unlockShopPortalAction(formData);
        if (result.success) {
          setLocked(false);
          setPin("");
          setError(null);
          resetTimer();
          return;
        }
        setError(result.error ?? "The salesperson PIN is incorrect.");
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to unlock the portal.");
      }
    });
  }

  if (!salespersonId) return null;

  return (
    <>
      {locked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/25">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Portal sleep mode</h2>
                <p className="text-sm text-slate-500">This shop device was idle for 5 minutes. Enter the salesperson PIN to continue.</p>
              </div>
            </div>
            <form onSubmit={onUnlockSubmit} className="space-y-3">
              <input type="hidden" name="salespersonId" value={salespersonId} />
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Operator</p>
                <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">{salespersonName ?? "Salesperson"}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">4–6 digit PIN</label>
                <Input
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={pin}
                  onChange={(event) => {
                    setPin(event.target.value);
                    setError(null);
                  }}
                  placeholder="Enter PIN"
                  maxLength={6}
                  required
                />
              </div>
              {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
              <Button className="w-full" isLoading={isPending} disabled={isPending} loadingText="Unlocking..."><ShieldCheck className="h-4 w-4" />Resume portal</Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
