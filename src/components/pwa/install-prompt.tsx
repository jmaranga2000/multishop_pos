"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissedAt = Number(localStorage.getItem("pwa-install-dismissed-at") ?? 0);
    if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    const handler = (e: Event) => { e.preventDefault(); setEvent(e as InstallEvent); setVisible(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !event) return null;
  return <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded-2xl border border-blue-200 bg-white p-4 shadow-2xl">
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-blue-50 p-2 text-blue-700"><Download className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1"><p className="font-bold">Install MultiShop POS</p><p className="mt-1 text-sm text-slate-500">Use the POS like a native app and keep approved cash sales working during connection interruptions.</p></div>
      <button aria-label="Dismiss" onClick={() => { localStorage.setItem("pwa-install-dismissed-at", String(Date.now())); setVisible(false); }}><X className="h-5 w-5 text-slate-400" /></button>
    </div>
    <div className="mt-4 flex justify-end"><Button onClick={async () => { await event.prompt(); await event.userChoice; setVisible(false); }}><Download className="h-4 w-4" />Install app</Button></div>
  </div>;
}
