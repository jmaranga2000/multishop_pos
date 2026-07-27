import Link from "next/link";
import { CloudOff, RefreshCw, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return <main className="flex min-h-screen items-center justify-center p-6"><div className="surface w-full max-w-xl rounded-3xl p-8 text-center">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><CloudOff className="h-8 w-8" /></div>
    <h1 className="mt-5 text-3xl font-extrabold">You are offline</h1>
    <p className="mx-auto mt-3 max-w-md text-slate-500">Previously synchronized shop products and approved cash sales remain available from the installed POS.</p>
    <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/shop/pos"><Button><ShoppingCart className="h-4 w-4" />Open POS</Button></Link><Button variant="secondary" onClick={undefined}><RefreshCw className="h-4 w-4" />Retry connection</Button></div>
  </div></main>;
}
