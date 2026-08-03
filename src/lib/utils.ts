import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoney(value: string | number, currency = "KES") {
  const amount = typeof value === "string" ? Number(value) : value
  const formatter = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  return formatter.format(Number.isFinite(amount) ? amount : 0)
}

export function formatDate(value: string | Date, locale = "en-KE") {
  const date = typeof value === "string" ? new Date(value) : value
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(locale) : ""
}

export function formatVariance(value: string | number, currency = "KES") {
  const amount = typeof value === "string" ? Number(value) : value
  const safeAmount = Number.isFinite(amount) ? Number(amount) : 0
  const formatter = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  if (safeAmount > 0) return `Surplus (+${formatter.format(safeAmount)})`
  if (safeAmount < 0) return `Shortage (${formatter.format(safeAmount)})`
  return `Balanced (${formatter.format(0)})`
}

export function getStockStatus(quantity: number, reorderLevel: number, criticalLevel: number) {
  if (quantity <= 0) return "OUT_OF_STOCK" as const
  if (quantity <= criticalLevel) return "CRITICAL" as const
  if (quantity <= reorderLevel) return "LOW_STOCK" as const
  return "IN_STOCK" as const
}

export function absoluteUrl(path: string) {
  if (path.startsWith("http")) return path;
  const base = process.env.APP_URL?.replace(/\/$/, "") ?? "https://localhost";
  const prefix = path.startsWith("/") ? "" : "/";
  return `${base}${prefix}${path}`;
}

export function fromMinorUnits(value: number | string) {
  const numeric = typeof value === "string" ? Number(value) : value
  return Number.isFinite(numeric) ? numeric / 100 : 0
}

export function toMinorUnits(value: number | string) {
  const numeric = typeof value === "string" ? Number(value) : value
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0
}
