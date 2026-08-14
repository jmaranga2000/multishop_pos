import { Suspense } from "react";
import { Store, ShieldCheck, WifiOff } from "lucide-react";
import { LoginPanel } from "./login-panel";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.08fr_.92fr]">
      <section className="hidden bg-[#0b1739] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-blue-500 p-3"><Store className="h-7 w-7" /></div>
          <div>
            <p className="text-xl font-extrabold">MultiShop POS</p>
            <p className="text-sm text-blue-200">One business. Every shop.</p>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[.18em] text-blue-300">Reliable retail operations</p>
          <h1 className="mt-4 text-5xl font-black leading-[1.08]">Sell confidently, even when the connection drops.</h1>
          <p className="mt-5 text-lg leading-8 text-blue-100/80">A modern multi-shop POS with offline cash sales, centralized stock visibility, low-stock alerts and weekly reports.</p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <WifiOff className="h-6 w-6 text-amber-300" />
              <p className="mt-3 font-bold">Offline-first POS</p>
              <p className="mt-1 text-sm text-blue-100/70">Keep essential shop operations moving.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <ShieldCheck className="h-6 w-6 text-emerald-300" />
              <p className="mt-3 font-bold">Shop isolation</p>
              <p className="mt-1 text-sm text-blue-100/70">Every account sees only its assigned shop.</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-blue-200/60">Secure RBAC • MongoDB • PWA • Push notifications</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-700 p-2 text-white"><Store className="h-5 w-5" /></div>
              <p className="font-extrabold">MultiShop POS</p>
            </div>
          </div>

          <p className="text-sm font-bold text-blue-700">WELCOME BACK</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">Sign in to your workspace</h2>
          <p className="mt-2 text-sm text-slate-500">Use the credentials issued by the administrator.</p>

          <div className="surface mt-7 rounded-3xl p-6">
            <Suspense
              fallback={
                <div>
                  <p className="mb-4">Loading...</p>
                  <form method="post" action="/api/auth/login" className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email address</label>
                      <input name="email" type="email" className="w-full rounded-md border px-3 py-2" required />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label>
                      <input name="password" type="password" className="w-full rounded-md border px-3 py-2" required />
                    </div>
                    <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-white">Sign in</button>
                    <p className="text-xs text-slate-500">If JavaScript is disabled or failed to load, use this form to sign in.</p>
                  </form>
                </div>
              }
            >
              <LoginPanel />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}
