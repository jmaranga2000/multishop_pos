"use client";

import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  authenticateSalespersonFingerprint,
  canUseBiometrics,
  enrollSalespersonFingerprint,
} from "@/lib/biometric-client";

function selectedCashier() {
  const salesperson = document.querySelector<HTMLInputElement | HTMLSelectElement>("#register-salesperson-id, [name='salespersonId']");
  if (!salesperson?.value) throw new Error("Choose the cashier first.");
  return salesperson.value;
}

function enteredPin() {
  const pin = document.querySelector<HTMLInputElement>("#register-pin, [name='pin']");
  if (!pin?.value) throw new Error("Enter the cashier PIN to set up fingerprint.");
  return pin.value;
}

export function FingerprintRegisterControls() {
  const [supported, setSupported] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [authenticationToken, setAuthenticationToken] = useState("");

  useEffect(() => {
    setSupported(canUseBiometrics());
  }, []);

  if (!supported) return null;

  async function useFingerprint() {
    setIsWorking(true);
    try {
      const token = await authenticateSalespersonFingerprint(selectedCashier());
      setAuthenticationToken(token);
      toast.success("Fingerprint verified. You can now open the register.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fingerprint could not be verified.");
    } finally {
      setIsWorking(false);
    }
  }

  async function setUpFingerprint() {
    setIsWorking(true);
    try {
      await enrollSalespersonFingerprint(selectedCashier(), enteredPin());
      toast.success("Fingerprint set up on this device. Use it to verify the cashier.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fingerprint setup could not be completed.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="biometricAuthToken" value={authenticationToken} />
      <p className="text-sm font-semibold text-slate-800">Fingerprint sign-in</p>
      <p className="text-xs text-slate-500">Use this device&apos;s fingerprint or Windows Hello. PIN remains available as a fallback.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="secondary" onClick={useFingerprint} disabled={isWorking} isLoading={isWorking} loadingText="Verifying...">
          <Fingerprint className="h-4 w-4" />Use fingerprint
        </Button>
        <Button type="button" variant="ghost" onClick={setUpFingerprint} disabled={isWorking}>
          <Fingerprint className="h-4 w-4" />Set up on this device
        </Button>
      </div>
      {authenticationToken ? <p className="text-xs font-semibold text-emerald-700">Fingerprint verified for this register opening.</p> : null}
    </div>
  );
}