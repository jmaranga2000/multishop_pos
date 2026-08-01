import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: { default: "MultiShop POS", template: "%s | MultiShop POS" },
  description: "Offline-first multi-shop point of sale and inventory management system",
  applicationName: "MultiShop POS",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MultiShop POS" },
};

export const viewport: Viewport = { themeColor: "#0f2a5f", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={cn("font-sans", geist.variable)}><head><link rel="manifest" href="/manifest.webmanifest" /></head><body>{children}<ServiceWorkerRegister /><InstallPrompt /><Toaster richColors position="top-right" /></body></html>;
}
