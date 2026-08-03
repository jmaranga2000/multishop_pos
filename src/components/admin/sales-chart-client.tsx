"use client";

import dynamic from "next/dynamic";

type SalesPoint = {
  label: string;
  sales: number;
};

const SalesChart = dynamic(
  () => import("./sales-chart").then((module) => module.SalesChart),
  { ssr: false },
);

export function SalesChartClient({ data }: { data: SalesPoint[] }) {
  return <SalesChart data={data} />;
}

export default SalesChartClient;
