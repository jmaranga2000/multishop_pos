"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { closeRegisterAction } from "@/actions/shop/register-actions";
import { formatMoney, formatVariance } from "@/lib/utils";

type RegisterCloseFormProps = {
  openSession: {
    id: string;
    register: { name: string };
    openingCash?: number | null;
    cashSalesTotal?: number | null;
    expectedCash?: number | null;
    openingMpesaBalance?: number | null;
    mpesaSalesTotal?: number | null;
    expectedMpesa?: number | null;
    unresolvedPayments?: number | null;
  };
  currency: string;
};

export function RegisterCloseForm({ openSession, currency }: RegisterCloseFormProps) {
  const searchParams = useSearchParams();
  const errorMessage = typeof searchParams.get("error") === "string" ? decodeURIComponent(searchParams.get("error") ?? "") : "";

  const [actualCash, setActualCash] = useState("");
  const [actualMpesaBalance, setActualMpesaBalance] = useState("");
  const [varianceReason, setVarianceReason] = useState("");
  const [unresolvedClosureReason, setUnresolvedClosureReason] = useState("");

  const expectedCash = Number(openSession.expectedCash ?? 0);
  const expectedMpesa = Number(openSession.expectedMpesa ?? 0);
  const cashVariance = useMemo(() => Number(actualCash || 0) - expectedCash, [actualCash, expectedCash]);
  const mpesaVariance = useMemo(() => Number(actualMpesaBalance || 0) - expectedMpesa, [actualMpesaBalance, expectedMpesa]);
  const requiresVarianceExplanation = Math.abs(cashVariance) > 0.0001 || Math.abs(mpesaVariance) > 0.0001;
  const varianceExplanationError = requiresVarianceExplanation && !varianceReason.trim();
  const requiresUnresolvedReason = Number(openSession.unresolvedPayments ?? 0) > 0 && !unresolvedClosureReason.trim();

  return (
    <form action={closeRegisterAction} className="space-y-4">
      <input type="hidden" name="sessionId" value={openSession.id} />
      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <label className="mb-2 block text-sm font-semibold text-amber-950">Cashier PIN required to close</label>
        <Input name="pin" type="password" inputMode="numeric" autoComplete="one-time-code" placeholder="Enter your personal PIN" maxLength={6} required />
        <p className="mt-1 text-xs text-amber-800">Only the cashier assigned to this register session can close it.</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-slate-900">Register close summary</p>
          <Badge tone={(openSession.unresolvedPayments ?? 0) > 0 ? "warning" : "success"}>
            {(openSession.unresolvedPayments ?? 0) > 0 ? `${openSession.unresolvedPayments} unresolved` : "Clean reconciliation"}
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase text-slate-500">Expected cash</p>
            <p className="mt-1 font-semibold text-slate-900">{formatMoney(expectedCash, currency)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase text-slate-500">Expected M-Pesa</p>
            <p className="mt-1 font-semibold text-slate-900">{formatMoney(expectedMpesa, currency)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase text-slate-500">Calculated cash variance</p>
            <p className="mt-1 font-semibold text-slate-900">{formatVariance(cashVariance, currency)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase text-slate-500">Calculated M-Pesa variance</p>
            <p className="mt-1 font-semibold text-slate-900">{formatVariance(mpesaVariance, currency)}</p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-slate-900">Cashier closeout inputs</p>
          <span className="text-xs text-slate-500">Allow actual counts to update the variance results live.</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Actual cash counted</label>
            <Input
              name="actualCash"
              type="number"
              min="0"
              step="0.01"
              placeholder="Physical cash counted"
              value={actualCash}
              onChange={(event) => setActualCash(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Actual M-Pesa balance</label>
            <Input
              name="actualMpesaBalance"
              type="number"
              min="0"
              step="0.01"
              placeholder="Actual M-Pesa balance"
              value={actualMpesaBalance}
              onChange={(event) => setActualMpesaBalance(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-3">
          <p className="text-xs uppercase text-slate-500">Derived cash variance</p>
          <p className="mt-1 font-semibold text-slate-900">{formatVariance(cashVariance, currency)}</p>
          <p className="mt-2 text-xs text-slate-500">{requiresVarianceExplanation ? "Variance detected. Provide an explanation below." : "Enter actual cash to calculate variance."}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-3">
          <p className="text-xs uppercase text-slate-500">Derived M-Pesa variance</p>
          <p className="mt-1 font-semibold text-slate-900">{formatVariance(mpesaVariance, currency)}</p>
          <p className="mt-2 text-xs text-slate-500">{actualMpesaBalance ? "Variance is calculated from expected M-Pesa balance." : "Enter actual M-Pesa balance to calculate variance."}</p>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Variance explanation</label>
        <textarea
          name="varianceReason"
          placeholder="Variance explanation required when counts differ"
          className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm"
          value={varianceReason}
          onChange={(event) => setVarianceReason(event.target.value)}
        />
        {varianceExplanationError ? (
          <p className="mt-2 text-sm text-red-700">A variance explanation is required because the cash or M-Pesa balance does not match expected values.</p>
        ) : null}
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Unresolved M-Pesa reason</label>
        <textarea
          name="unresolvedClosureReason"
          placeholder="Unresolved M-Pesa reason (required if any payment remains unresolved)"
          className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm"
          value={unresolvedClosureReason}
          onChange={(event) => setUnresolvedClosureReason(event.target.value)}
        />
        {requiresUnresolvedReason ? (
          <p className="mt-2 text-sm text-red-700">Provide a closure reason because there are unresolved M-Pesa payments.</p>
        ) : null}
      </div>

      <Button type="submit" variant="danger" className="w-full">
        <LockKeyhole className="h-4 w-4" /> Close and reconcile
      </Button>
    </form>
  );
}
