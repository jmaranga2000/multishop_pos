"use client";
import dynamic from "next/dynamic";
import React from "react";

const SalesChart = dynamic(() => import("./sales-chart").then((m) => m.SalesChart), { ssr: false });

export function SalesChartClient(props: any) {
  return <SalesChart {...props} />;
}

export default SalesChartClient;
