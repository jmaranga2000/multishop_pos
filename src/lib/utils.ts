import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number | string, currency = "KES") {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function toMinorUnits(value: number | string) {
  return Math.round(Number(value) * 100);
}

export function fromMinorUnits(value: number) {
  return value / 100;
}

export function getStockStatus(quantity: number, reorderLevel: number, criticalLevel: number) {
  if (quantity <= 0) return "OUT_OF_STOCK" as const;
  if (quantity <= criticalLevel) return "CRITICAL" as const;
  if (quantity <= reorderLevel) return "LOW_STOCK" as const;
  return "IN_STOCK" as const;
}

export function safeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function absoluteUrl(path = "") {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
