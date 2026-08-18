"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Delete, Eye, EyeOff, Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { unlockShopPortalAction } from "@/actions/shop/register-actions";
import { unlockCounterAction } from "@/actions/shop/register-actions";
import { authenticateSalespersonFingerprint, canUseBiometrics } from "@/lib/biometric-client";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

type UnlockResult = { success: boolean; error?: string };

export function ShopPortalLockGuard({ salespersonId, salespersonName, counterId, counterName, counterAccessGranted }: { salespersonId?: string | null; salespersonName?: string | null; counterId?: string | null; counterName?: string | null; counterAccessGranted: boolean }) {
  const [locked, setLocked] = useState(false);
  const [counterLocked, setCounterLocked] = useState(!counterAccessGranted);
  const [counterPin, setCounterPin] = useState("");
  const [showCounterPin, setShowCounterPin] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fingerprintSupported, setFingerprintSupported] = useState(false);
  const [fingerprintPending, setFingerprintPending] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<number | null>(null);

  const resetTimer = () => {
    if (typeof window === "undefined" || !salespersonId) return;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setLocked(true);
    }, IDLE_TIMEOUT_MS);
  };

  const finishUnlock = (result: UnlockResult) => {
    if (result.success) {
      setLocked(false);
      setPin("");
      setError(null);
      resetTimer();
      return;
    }
    setError(result.error ?? "The salesperson PIN is incorrect.");
  };

  useEffect(() => {
    setFingerprintSupported(canUseBiometrics());
  }, []);

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
        finishUnlock(await unlockShopPortalAction(formData));
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to unlock the portal.");
      }
    });
  }

  async function onCounterUnlockSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await unlockCounterAction(counterPin);
      if (result.success) {
        setCounterLocked(false);
        setCounterPin("");
        window.location.reload();
      } else {
        setError(result.error ?? "The counter PIN is incorrect.");
      }
    });
  }

  async function unlockWithFingerprint() {
    if (!salespersonId) return;

    setError(null);
    setFingerprintPending(true);
    try {
      const biometricAuthToken = await authenticateSalespersonFingerprint(salespersonId);
      const formData = new FormData();
      formData.set("salespersonId", salespersonId);
      formData.set("biometricAuthToken", biometricAuthToken);
      startTransition(async () => {
        try {
          finishUnlock(await unlockShopPortalAction(formData));
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to unlock the portal.");
        } finally {
          setFingerprintPending(false);
        }
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Fingerprint could not be verified.");
      setFingerprintPending(false);
    }
  }

  function appendCounterDigit(digit: string) {
    if (isPending || counterPin.length >= 6) return;
    setCounterPin((current) => `${current}${digit}`);
    setError(null);
  }

  function removeCounterDigit() {
    if (isPending) return;
    setCounterPin((current) => current.slice(0, -1));
    setError(null);
  }

  function clearCounterPin() {
    if (isPending) return;
    setCounterPin("");
    setError(null);
  }

  async function backToLogin() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <>
      {counterLocked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-3 text-blue-700"><LockKeyhole className="h-5 w-5" /></div><div><h2 className="text-lg font-extrabold text-slate-900">Enter counter PIN</h2><p className="text-sm text-slate-500">Identify this terminal before opening the shop portal.</p></div></div>
            <form onSubmit={onCounterUnlockSubmit} className="space-y-3">
              <div className="relative">
                <Input type={showCounterPin ? "text" : "password"} inputMode="numeric" value={counterPin} onChange={(event) => { setCounterPin(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }} placeholder="Six-digit counter PIN" maxLength={6} pattern="[0-9]{6}" required autoFocus className="pr-11 text-center text-xl tracking-[0.45em]" />
                <button type="button" aria-label={showCounterPin ? "Hide counter PIN" : "Show counter PIN"} onClick={() => setShowCounterPin((visible) => !visible)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-700">
                  {showCounterPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="hidden grid-cols-3 gap-3 md:grid" aria-label="Counter PIN keypad">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                  <button key={digit} type="button" onClick={() => appendCounterDigit(digit)} disabled={isPending || counterPin.length >= 6} className="h-14 rounded-xl border border-slate-200 bg-slate-50 text-2xl font-bold text-slate-800 shadow-sm transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                    {digit}
                  </button>
                ))}
                <button type="button" onClick={clearCounterPin} disabled={isPending} className="h-14 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Clear</button>
                <button type="button" onClick={() => appendCounterDigit("0")} disabled={isPending || counterPin.length >= 6} className="h-14 rounded-xl border border-slate-200 bg-slate-50 text-2xl font-bold text-slate-800 shadow-sm transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50">0</button>
                <button type="button" onClick={removeCounterDigit} disabled={isPending || counterPin.length === 0} aria-label="Delete last counter PIN digit" className="flex h-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><Delete className="h-6 w-6" /></button>
              </div>
              {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
              <Button className="w-full" isLoading={isPending} disabled={isPending || counterPin.length !== 6} loadingText="Verifying...">Enter counter</Button>
              {isPending ? <p className="text-center text-xs font-semibold text-blue-700" role="status" aria-live="polite">Verifying counter PIN...</p> : null}
              <Button type="button" variant="ghost" className="w-full" onClick={backToLogin} disabled={isPending || loggingOut} isLoading={loggingOut} loadingText="Returning...">
                <ArrowLeft className="h-4 w-4" />Back to login
              </Button>
            </form>
          </div>
        </div>
      )}
      {locked && salespersonId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/25">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Portal sleep mode</h2>
                <p className="text-sm text-slate-500">This shop device was idle for 5 minutes. Verify the salesperson to continue.</p>
              </div>
            </div>
            <form onSubmit={onUnlockSubmit} className="space-y-3">
              <input type="hidden" name="salespersonId" value={salespersonId} />
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Operator</p>
                <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">{salespersonName ?? "Salesperson"}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">4-6 digit PIN</label>
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
              <Button className="w-full" isLoading={isPending} disabled={isPending || fingerprintPending} loadingText="Unlocking..."><ShieldCheck className="h-4 w-4" />Resume with PIN</Button>
              {fingerprintSupported ? (
                <Button type="button" variant="secondary" className="w-full" onClick={unlockWithFingerprint} disabled={isPending || fingerprintPending} isLoading={fingerprintPending} loadingText="Verifying..."><Fingerprint className="h-4 w-4" />Resume with fingerprint</Button>
              ) : null}
            </form>
          </div>
        </div>
      )}
    </>
  );
}