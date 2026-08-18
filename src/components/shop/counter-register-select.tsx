"use client";

import { useState } from "react";

type CounterOption = { id: string; name: string; status: "ACTIVE" | "INACTIVE"; registerId?: string | null; currentSession?: unknown };

export function CounterRegisterSelect({ counters }: { counters: CounterOption[] }) {
  const [counterId, setCounterId] = useState("");
  const selected = counters.find((counter) => counter.id === counterId);

  return (
    <>
      <label className="mb-2 block text-sm font-semibold text-slate-700">Counter / terminal</label>
      <select name="counterId" value={counterId} onChange={(event) => setCounterId(event.target.value)} required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
        <option value="">Select counter</option>
        {counters.map((counter) => <option key={counter.id} value={counter.id} disabled={counter.status !== "ACTIVE" || Boolean(counter.currentSession) || !counter.registerId}>{counter.name}{counter.status !== "ACTIVE" ? " (Inactive)" : ""}{counter.currentSession ? " (In use)" : ""}</option>)}
      </select>
      <input type="hidden" name="registerId" value={selected?.registerId ?? ""} />
      {!selected?.registerId && counterId && <p className="mt-1 text-xs text-red-600">This counter has no active register yet.</p>}
    </>
  );
}