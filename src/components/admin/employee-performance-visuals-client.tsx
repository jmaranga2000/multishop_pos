"use client";

import dynamic from "next/dynamic";

type DailySale = { label: string; sales: number; transactions: number };
type PaymentBreakdown = { CASH: number; MPESA: number; CARD: number; BANK_TRANSFER: number; MIXED: number };

const EmployeePerformanceVisuals = dynamic(
  () => import("./employee-performance-visuals").then((module) => module.EmployeePerformanceVisuals),
  { ssr: false },
);

export function EmployeePerformanceVisualsClient({ currency, dailySales, payments }: { currency: string; dailySales: DailySale[]; payments: PaymentBreakdown }) {
  return <EmployeePerformanceVisuals currency={currency} dailySales={dailySales} payments={payments} />;
}