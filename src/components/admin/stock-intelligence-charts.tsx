"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, RotateCcw, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/utils";

type StockStatus = "IN_STOCK" | "LOW_STOCK" | "CRITICAL" | "OUT_OF_STOCK";

type InventoryRow = {
  id: string;
  shopId: string;
  productId: string;
  quantity: number;
  costPrice: number | string;
  sellingPrice: number | string;
  reorderLevel: number;
  criticalLevel: number;
  stockStatus: StockStatus;
  shop?: { id: string; name: string } | null;
  product?: { id: string; name: string; sku: string; categoryId?: string | null } | null;
  categoryId?: string | null;
};

type HistoryPoint = {
  label: string;
  low: number;
  critical: number;
  out: number;
};

type TrendPoint = {
  label: string;
  received: number;
  sold: number;
  transferred: number;
  adjusted: number;
};

type Props = {
  inventory: InventoryRow[];
  shops: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  history: HistoryPoint[];
  movementTrend: TrendPoint[] | Record<string, TrendPoint>;
  businessCurrency: string;
  loading?: boolean;
  error?: string | null;
};

type FilterState = {
  period: "7d" | "30d" | "90d" | "all";
  shopId: string;
  categoryId: string;
  status: "all" | StockStatus;
};

const STATUS_TONES: Record<StockStatus, { label: string; color: string; fill: string }> = {
  IN_STOCK: { label: "Healthy", color: "text-emerald-700", fill: "#16a34a" },
  LOW_STOCK: { label: "Low", color: "text-amber-700", fill: "#f59e0b" },
  CRITICAL: { label: "Critical", color: "text-orange-700", fill: "#f97316" },
  OUT_OF_STOCK: { label: "Out of Stock", color: "text-red-800", fill: "#991b1b" },
};

function formatStatusLabel(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\w/g, (letter) => letter.toUpperCase());
}

function formatSeriesValue(value: number) {
  return value.toLocaleString();
}

export function StockIntelligenceCharts({
  inventory,
  shops,
  categories,
  history,
  movementTrend,
  businessCurrency,
  loading = false,
  error = null,
}: Props) {
  const [filters, setFilters] = useState<FilterState>({
    period: "30d",
    shopId: "all",
    categoryId: "all",
    status: "all",
  });
  const [valueMetricKey, setValueMetricKey] = useState<"costValue" | "retailValue" | "grossProfit">("costValue");

  const filteredInventory = useMemo(() => {
    return inventory.filter((entry) => {
      const matchesShop = filters.shopId === "all" || entry.shopId === filters.shopId;
      const matchesCategory = filters.categoryId === "all" || entry.product?.categoryId === filters.categoryId;
      const matchesStatus = filters.status === "all" || entry.stockStatus === filters.status;
      return matchesShop && matchesCategory && matchesStatus;
    });
  }, [filters.categoryId, filters.shopId, filters.status, inventory]);

  const visibleHistory = useMemo(() => {
    if (!history.length) return [];
    const limit = filters.period === "7d" ? 7 : filters.period === "30d" ? 30 : filters.period === "90d" ? 90 : history.length;
    return history.slice(-limit);
  }, [filters.period, history]);

  const visibleMovement = useMemo(() => {
    const trendEntries = Array.isArray(movementTrend) ? movementTrend : Object.values(movementTrend ?? {});
    if (!trendEntries.length) return [];
    const limit = filters.period === "7d" ? 7 : filters.period === "30d" ? 30 : filters.period === "90d" ? 90 : trendEntries.length;
    return trendEntries.slice(-limit);
  }, [filters.period, movementTrend]);

  const distributionData = useMemo(() => {
    const healthy = filteredInventory.filter((entry) => entry.stockStatus === "IN_STOCK").length;
    const low = filteredInventory.filter((entry) => entry.stockStatus === "LOW_STOCK").length;
    const critical = filteredInventory.filter((entry) => entry.stockStatus === "CRITICAL").length;
    const out = filteredInventory.filter((entry) => entry.stockStatus === "OUT_OF_STOCK").length;

    return [
      { name: "Healthy", value: healthy, status: "IN_STOCK", fill: STATUS_TONES.IN_STOCK.fill },
      { name: "Low Stock", value: low, status: "LOW_STOCK", fill: STATUS_TONES.LOW_STOCK.fill },
      { name: "Critical", value: critical, status: "CRITICAL", fill: STATUS_TONES.CRITICAL.fill },
      { name: "Out of Stock", value: out, status: "OUT_OF_STOCK", fill: STATUS_TONES.OUT_OF_STOCK.fill },
    ].filter((entry) => entry.value > 0);
  }, [filteredInventory]);

  const healthyPercent = filteredInventory.length ? Math.round((filteredInventory.filter((entry) => entry.stockStatus === "IN_STOCK").length / filteredInventory.length) * 100) : 0;
  const distributionChartData = distributionData.length ? distributionData : [{ name: "No data", value: 1, status: "IN_STOCK", fill: "#cbd5e1" }];

  const shopRiskSummary = useMemo(() => {
    const summary = shops.map((shop) => {
      const rows = filteredInventory.filter((entry) => entry.shopId === shop.id);
      const healthy = rows.filter((entry) => entry.stockStatus === "IN_STOCK").length;
      const low = rows.filter((entry) => entry.stockStatus === "LOW_STOCK").length;
      const critical = rows.filter((entry) => entry.stockStatus === "CRITICAL").length;
      const out = rows.filter((entry) => entry.stockStatus === "OUT_OF_STOCK").length;
      const problems = low + critical + out;
      const bucket = out > 0 ? "Severely Understocked" : critical > 0 ? "Critical Pressure" : low > 0 ? "Running Low" : "Healthy";
      return { shop, healthy, low, critical, out, problems, bucket };
    });
    return summary.sort((left, right) => right.problems - left.problems || right.critical - left.critical || right.out - left.out);
  }, [filteredInventory, shops]);

  const riskDistribution = useMemo(() => {
    const healthy = shopRiskSummary.filter((entry) => entry.bucket === "Healthy").length;
    const low = shopRiskSummary.filter((entry) => entry.bucket === "Running Low").length;
    const critical = shopRiskSummary.filter((entry) => entry.bucket === "Critical Pressure").length;
    const out = shopRiskSummary.filter((entry) => entry.bucket === "Severely Understocked").length;
    return [
      { name: "Healthy", value: healthy, fill: STATUS_TONES.IN_STOCK.fill },
      { name: "Running Low", value: low, fill: STATUS_TONES.LOW_STOCK.fill },
      { name: "Critical Pressure", value: critical, fill: STATUS_TONES.CRITICAL.fill },
      { name: "Severely Understocked", value: out, fill: STATUS_TONES.OUT_OF_STOCK.fill },
    ];
  }, [shopRiskSummary]);
  const riskDistributionChartData = riskDistribution.some((entry) => entry.value > 0) ? riskDistribution : [{ name: "No data", value: 1, fill: "#cbd5e1" }];

  const shopHealthData = useMemo(() => {
    return shopRiskSummary.map((entry) => ({
      name: entry.shop.name,
      shopId: entry.shop.id,
      healthy: entry.healthy,
      low: entry.low,
      critical: entry.critical,
      out: entry.out,
      risk: entry.problems,
    }));
  }, [shopRiskSummary]);
  const shopHealthChartData = shopHealthData.length ? shopHealthData : [{ name: "No shops", shopId: "placeholder", healthy: 0, low: 0, critical: 0, out: 0, risk: 0 }];

  const urgentProducts = useMemo(() => {
    return filteredInventory
      .filter((entry) => entry.stockStatus !== "IN_STOCK")
      .sort((left, right) => {
        const priority = { OUT_OF_STOCK: 0, CRITICAL: 1, LOW_STOCK: 2, IN_STOCK: 3 } as const;
        return priority[left.stockStatus] - priority[right.stockStatus] || left.quantity - right.quantity;
      })
      .slice(0, 10)
      .map((entry) => ({
        name: entry.product?.name ?? "Unknown product",
        sku: entry.product?.sku ?? "",
        status: entry.stockStatus,
        stock: entry.quantity,
      }));
  }, [filteredInventory]);
  const urgentProductsChartData = urgentProducts.length ? urgentProducts : [{ name: "No urgent products", sku: "", status: "IN_STOCK", stock: 0 }];

  const runningLowShops = useMemo(() => {
    return shopRiskSummary
      .map((entry) => ({
        name: entry.shop.name,
        shopId: entry.shop.id,
        affectedProducts: entry.low + entry.critical + entry.out,
        criticalItems: entry.critical,
        outOfStockItems: entry.out,
      }))
      .sort((left, right) => right.affectedProducts - left.affectedProducts || right.criticalItems - left.criticalItems || right.outOfStockItems - left.outOfStockItems);
  }, [shopRiskSummary]);
  const runningLowShopsChartData = runningLowShops.length ? runningLowShops : [{ name: "No shop alerts", shopId: "placeholder", affectedProducts: 0, criticalItems: 0, outOfStockItems: 0 }];

  const valueMetric = useMemo(() => {
    return shopRiskSummary.map((entry) => {
      const rows = filteredInventory.filter((item) => item.shopId === entry.shop.id);
      const costValue = rows.reduce((sum, item) => sum + Number(item.costPrice) * item.quantity, 0);
      const retailValue = rows.reduce((sum, item) => sum + Number(item.sellingPrice) * item.quantity, 0);
      const grossProfit = retailValue - costValue;
      return {
        name: entry.shop.name,
        shopId: entry.shop.id,
        costValue,
        retailValue,
        grossProfit,
      };
    });
  }, [filteredInventory, shopRiskSummary]);
  const valueMetricChartData = valueMetric.length ? valueMetric : [{ name: "No value", shopId: "placeholder", costValue: 0, retailValue: 0, grossProfit: 0 }];

  const visibleTableRows = useMemo(() => {
    return filteredInventory.slice().sort((left, right) => {
      const priority = { OUT_OF_STOCK: 0, CRITICAL: 1, LOW_STOCK: 2, IN_STOCK: 3 } as const;
      return priority[left.stockStatus] - priority[right.stockStatus] || left.quantity - right.quantity;
    });
  }, [filteredInventory]);
  const visibleHistoryChartData = visibleHistory.length ? visibleHistory : [{ label: "No data", low: 0, critical: 0, out: 0 }];
  const visibleMovementChartData = visibleMovement.length ? visibleMovement : [{ label: "No data", received: 0, sold: 0, transferred: 0, adjusted: 0 }];

  const hasInventoryData = filteredInventory.length > 0;
  const hasRiskData = riskDistribution.some((entry) => entry.value > 0);
  const hasShopHealthData = shopHealthData.length > 0;
  const hasHistoryData = visibleHistory.length > 0;
  const hasUrgentProducts = urgentProducts.length > 0;
  const hasLowShopData = runningLowShops.length > 0;
  const hasValueData = valueMetric.length > 0;
  const hasMovementData = visibleMovement.length > 0;

  const setFilter = (key: keyof FilterState, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ period: "30d", shopId: "all", categoryId: "all", status: "all" });
  };

  const statusValue = (status: StockStatus) => status === "IN_STOCK" ? "Healthy" : status === "LOW_STOCK" ? "Low" : status === "CRITICAL" ? "Critical" : "Out of Stock";

  const chartCard = (title: string, subtitle: string, content: React.ReactNode) => (
    <Card className="rounded-3xl border border-slate-200 bg-white p-0 shadow-sm">
      <CardHeader className="px-5 pt-5">
        <CardTitle className="text-lg font-black">{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5">{content}</CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Card className="mt-4 rounded-3xl border border-slate-200 p-8 text-center">
        <p className="text-sm font-semibold text-slate-700">Loading stock intelligence charts…</p>
        <p className="mt-2 text-sm text-slate-500">Preparing live inventory, trend, and movement visuals.</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-4 rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-semibold text-red-700">Unable to load stock intelligence</p>
        <p className="mt-2 text-sm text-red-600">{error}</p>
      </Card>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <Card className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">Interactive filters</p>
            <p className="text-sm text-slate-500">Refine the stock review by period, shop, category and stock status.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="text-sm font-medium text-slate-600">
              <span className="mb-1 block">Period</span>
              <select value={filters.period} onChange={(event) => setFilter("period", event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
                <option value="all">All history</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-600">
              <span className="mb-1 block">Shop</span>
              <select value={filters.shopId} onChange={(event) => setFilter("shopId", event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                <option value="all">All shops</option>
                {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-600">
              <span className="mb-1 block">Category</span>
              <select value={filters.categoryId} onChange={(event) => setFilter("categoryId", event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                <option value="all">All categories</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-600">
              <span className="mb-1 block">Status</span>
              <select value={filters.status} onChange={(event) => setFilter("status", event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                <option value="all">All statuses</option>
                <option value="IN_STOCK">Healthy</option>
                <option value="LOW_STOCK">Low</option>
                <option value="CRITICAL">Critical</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
            </label>
            <Button variant="secondary" size="sm" onClick={clearFilters} className="self-end">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {chartCard(
          "Stock status distribution",
          "Healthy, low, critical and out-of-stock records across the filtered view.",
          <div className="relative h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={2}
                  onClick={(entry: any) => setFilter("status", entry.status)}
                >
                  {distributionData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(value) => [`${value ?? 0} records`, "Records"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-black">{filteredInventory.length}</p>
              <p className="text-sm text-slate-500">total records</p>
              <p className="mt-1 text-sm font-semibold text-emerald-700">{healthyPercent}% healthy</p>
            </div>
            {!hasInventoryData ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                <p className="text-sm font-medium text-slate-500">No matching stock records</p>
              </div>
            ) : null}
          </div>,
        )}

        {chartCard(
          "Shops at risk",
          "A radial overview of shops with healthy, low, critical and out-of-stock conditions.",
          <div className="relative h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart data={riskDistributionChartData} innerRadius="20%" outerRadius="100%" startAngle={180} endAngle={0}>
                <RadialBar dataKey="value" background />
                <Tooltip formatter={(value) => [`${value ?? 0} shops`, "Shops"]} />
                <Legend />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-black">{riskDistribution.reduce((sum, entry) => sum + entry.value, 0)}</p>
              <p className="text-sm text-slate-500">shops reviewed</p>
              <p className="mt-1 text-sm font-semibold text-red-700">{Math.round((riskDistribution.filter((entry) => entry.name !== "Healthy").reduce((sum, entry) => sum + entry.value, 0) / Math.max(riskDistribution.reduce((sum, entry) => sum + entry.value, 0), 1)) * 100)}% at risk</p>
            </div>
            {!hasRiskData ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                <p className="text-sm font-medium text-slate-500">No shop-level risk data</p>
              </div>
            ) : null}
          </div>,
        )}

        {chartCard(
          "Stock health by shop",
          "Each shop shows healthy, low, critical and out-of-stock counts with the highest-risk shops first.",
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shopHealthChartData} layout="vertical" margin={{ top: 10, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="healthy" stackId="a" fill={STATUS_TONES.IN_STOCK.fill} onClick={(entry: any) => { setFilter("shopId", entry.shopId); setFilter("status", "IN_STOCK"); }} />
                <Bar dataKey="low" stackId="a" fill={STATUS_TONES.LOW_STOCK.fill} onClick={(entry: any) => { setFilter("shopId", entry.shopId); setFilter("status", "LOW_STOCK"); }} />
                <Bar dataKey="critical" stackId="a" fill={STATUS_TONES.CRITICAL.fill} onClick={(entry: any) => { setFilter("shopId", entry.shopId); setFilter("status", "CRITICAL"); }} />
                <Bar dataKey="out" stackId="a" fill={STATUS_TONES.OUT_OF_STOCK.fill} onClick={(entry: any) => { setFilter("shopId", entry.shopId); setFilter("status", "OUT_OF_STOCK"); }} />
              </BarChart>
            </ResponsiveContainer>
            {!hasShopHealthData ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                <p className="text-sm font-medium text-slate-500">No shop-level health data</p>
              </div>
            ) : null}
          </div>,
        )}

        {chartCard(
          "Stock health trend",
          "Historical low, critical and out-of-stock totals from saved stock snapshots.",
          <div className="relative h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visibleHistoryChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="low" stroke={STATUS_TONES.LOW_STOCK.fill} strokeWidth={3} />
                <Line type="monotone" dataKey="critical" stroke={STATUS_TONES.CRITICAL.fill} strokeWidth={3} />
                <Line type="monotone" dataKey="out" stroke={STATUS_TONES.OUT_OF_STOCK.fill} strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
            {!hasHistoryData ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                <p className="text-sm font-medium text-slate-500">No snapshot history yet</p>
              </div>
            ) : null}
          </div>,
        )}

        {chartCard(
          "Most urgent products",
          "Top 10 products needing restocking, sorted by urgency.",
          <div className="relative h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={urgentProductsChartData} layout="vertical" margin={{ top: 8, right: 16, left: 10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="stock" fill={STATUS_TONES.OUT_OF_STOCK.fill} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {!hasUrgentProducts ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                <p className="text-sm font-medium text-slate-500">No urgent products in this view</p>
              </div>
            ) : null}
          </div>,
        )}

        {chartCard(
          "Shops running low",
          "Ranked by affected products, critical items and out-of-stock items.",
          <div className="relative h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={runningLowShopsChartData} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="affectedProducts" fill={STATUS_TONES.LOW_STOCK.fill} radius={[0, 6, 6, 0]} />
                <Bar dataKey="criticalItems" fill={STATUS_TONES.CRITICAL.fill} radius={[0, 6, 6, 0]} />
                <Bar dataKey="outOfStockItems" fill={STATUS_TONES.OUT_OF_STOCK.fill} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {!hasLowShopData ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                <p className="text-sm font-medium text-slate-500">No low-stock shops in this view</p>
              </div>
            ) : null}
          </div>,
        )}

        {chartCard(
          "Stock value by shop",
          "Compare cost value, retail value and potential gross profit by shop.",
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(["costValue", "retailValue", "grossProfit"] as const).map((metric) => (
                <Button key={metric} variant={valueMetricKey === metric ? "primary" : "secondary"} size="sm" className="capitalize" onClick={() => setValueMetricKey(metric)}>
                  {metric === "costValue" ? "Cost value" : metric === "retailValue" ? "Retail value" : "Gross profit"}
                </Button>
              ))}
            </div>
            <div className="relative h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={valueMetricChartData.map((entry) => ({ name: entry.name, value: entry[valueMetricKey], fill: STATUS_TONES.IN_STOCK.fill }))} dataKey="value" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {valueMetric.map((entry) => <Cell key={entry.name} fill={STATUS_TONES.IN_STOCK.fill} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [formatMoney(String(value ?? 0), businessCurrency), valueMetricKey === "costValue" ? "Cost value" : valueMetricKey === "retailValue" ? "Retail value" : "Gross profit"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              {!hasValueData ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                  <p className="text-sm font-medium text-slate-500">No value data for this selection</p>
                </div>
              ) : null}
            </div>
          </div>,
        )}

        {chartCard(
          "Stock movement trend",
          "Received, sold, transferred and adjusted quantities over time.",
          <div className="relative h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visibleMovementChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="received" stroke={STATUS_TONES.IN_STOCK.fill} strokeWidth={3} />
                <Line type="monotone" dataKey="sold" stroke={STATUS_TONES.CRITICAL.fill} strokeWidth={3} />
                <Line type="monotone" dataKey="transferred" stroke={STATUS_TONES.LOW_STOCK.fill} strokeWidth={3} />
                <Line type="monotone" dataKey="adjusted" stroke={STATUS_TONES.OUT_OF_STOCK.fill} strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
            {!hasMovementData ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                <p className="text-sm font-medium text-slate-500">No movement history yet</p>
              </div>
            ) : null}
          </div>,
        )}
      </div>

      <Card className="rounded-3xl border border-slate-200 bg-white p-0 shadow-sm">
        <CardHeader className="px-5 pt-5">
          <CardTitle className="text-lg font-black">Filtered stock report</CardTitle>
          <CardDescription>The table below updates as you choose a status, shop or category filter.</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {visibleTableRows.length ? (
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Shop</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTableRows.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.shop?.name ?? "Unknown"}</td>
                      <td>
                        <div className="font-semibold">{entry.product?.name ?? "Unknown product"}</div>
                        <div className="text-xs text-slate-500">{entry.product?.sku ?? ""}</div>
                      </td>
                      <td>{categories.find((category) => category.id === entry.product?.categoryId)?.name ?? "Uncategorized"}</td>
                      <td>{entry.quantity}</td>
                      <td><Badge tone={entry.stockStatus === "IN_STOCK" ? "success" : entry.stockStatus === "LOW_STOCK" ? "warning" : "danger"}>{formatStatusLabel(entry.stockStatus)}</Badge></td>
                      <td>{formatMoney((Number(entry.costPrice) * entry.quantity).toString(), businessCurrency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No rows match your filters" description="Choose a different status or shop to broaden the report." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
