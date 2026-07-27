"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

export function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
      if (registration.waiting) setWaitingWorker(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) setWaitingWorker(worker);
        });
      });
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!waitingWorker) return;
    toast("A new version is available", {
      description: "Update when you are not processing a sale.",
      action: { label: "Update now", onClick: () => waitingWorker.postMessage({ type: "SKIP_WAITING" }) },
      duration: 15000,
    });
  }, [waitingWorker]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const reload = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", reload);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", reload);
  }, []);

  return null;
}
