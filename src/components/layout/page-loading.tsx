import { LoaderCircle, Store } from "lucide-react";

export function PageLoading() {
  return (
    <div className="flex min-h-[calc(100vh-160px)] items-center justify-center px-4" role="status" aria-live="polite">
      <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-slate-200 bg-white px-7 py-9 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Store className="h-7 w-7" /></div>
        <LoaderCircle className="mt-5 h-6 w-6 animate-spin text-blue-600" />
        <h2 className="mt-4 font-extrabold text-slate-900">Opening module</h2>
        <p className="mt-1 text-sm text-slate-500">Loading the latest information for you…</p>
      </div>
    </div>
  );
}