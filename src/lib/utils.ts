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

export function getStockStatus(quantity: number, reorderLevel: number, criticalLevel: number) {
  if (quantity <= 0) return "OUT_OF_STOCK" as const
  if (quantity <= criticalLevel) return "CRITICAL" as const
  if (quantity <= reorderLevel) return "LOW_STOCK" as const
  return "IN_STOCK" as const
}

export function absoluteUrl(path: string) {
  return path.startsWith("http") ? path : `https://localhost${path}`
}

export function fromMinorUnits(value: number | string) {
  const numeric = typeof value === "string" ? Number(value) : value
  return Number.isFinite(numeric) ? numeric / 100 : 0
}

export function toMinorUnits(value: number | string) {
  const numeric = typeof value === "string" ? Number(value) : value
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0
}
