export type StockStatusKey = "IN_STOCK" | "LOW_STOCK" | "CRITICAL" | "OUT_OF_STOCK";

export type StockStatusMeta = {
  label: string;
  slug: string;
  tone: "amber" | "red" | "slate" | "emerald";
  description: string;
};

export function resolveStockStatusKey(slug: string): StockStatusKey | null {
  const normalizedSlug = slug?.toLowerCase();

  switch (normalizedSlug) {
    case "low-stock":
      return "LOW_STOCK";
    case "critical-stock":
      return "CRITICAL";
    case "out-of-stock":
      return "OUT_OF_STOCK";
    case "healthy-stock":
      return "IN_STOCK";
    default:
      return null;
  }
}

export function getStockStatusMeta(status: StockStatusKey): StockStatusMeta {
  switch (status) {
    case "LOW_STOCK":
      return {
        label: "Low stock",
        slug: "low-stock",
        tone: "amber",
        description: "Products that are approaching their reorder threshold.",
      };
    case "CRITICAL":
      return {
        label: "Critical stock",
        slug: "critical-stock",
        tone: "red",
        description: "Products that require immediate restocking attention.",
      };
    case "OUT_OF_STOCK":
      return {
        label: "Out of stock",
        slug: "out-of-stock",
        tone: "slate",
        description: "Products that are currently unavailable for sale.",
      };
    default:
      return {
        label: "Healthy stock",
        slug: "healthy-stock",
        tone: "emerald",
        description: "Products that are within a healthy inventory range.",
      };
  }
}
