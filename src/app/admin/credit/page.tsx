"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney, fromMinorUnits } from "@/lib/utils";
import { TrendingUp, AlertCircle, Users } from "lucide-react";
import Link from "next/link";

interface CreditMetrics {
  totalOutstanding: number;
  totalOverdue: number;
  totalCreditLimit: number;
  utilizationRate: string;
  customerCount: number;
  overdueCustomerCount: number;
  activeCredit: boolean;
  topCustomers: Array<{
    id: string;
    name: string;
    outstandingMinor: number;
    creditLimitMinor: number;
  }>;
  overdueCustomers: Array<{
    id: string;
    name: string;
    outstandingMinor: number;
    daysSinceLast: number;
  }>;
}

export default function CreditDashboardPage() {
  const [metrics, setMetrics] = useState<CreditMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch("/api/admin/credit-metrics");
        if (!res.ok) throw new Error("Failed to fetch metrics");
        const data = await res.json();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  if (loading) return <div className="p-6">Loading credit dashboard...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!metrics) return <div className="p-6">Metrics not found</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Credit Management Dashboard</h1>
          <p className="text-gray-600">Monitor customer credit portfolio and overdue accounts</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Outstanding</p>
                <p className="text-2xl font-bold mt-2">
                  {formatMoney(fromMinorUnits(metrics.totalOutstanding))}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overdue Balance</p>
                <p className="text-2xl font-bold mt-2 text-red-600">
                  {formatMoney(fromMinorUnits(metrics.totalOverdue))}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Credit Utilization</p>
                <p className="text-2xl font-bold mt-2">
                  {metrics.utilizationRate}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-sm font-bold">{metrics.utilizationRate}%</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Customers on Credit</p>
                <p className="text-2xl font-bold mt-2">
                  {metrics.customerCount}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {metrics.overdueCustomerCount} overdue
                </p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Customers by Outstanding */}
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4">Top Customers by Outstanding Balance</h2>
            <div className="space-y-3">
              {metrics.topCustomers.length ? (
                metrics.topCustomers.map((customer, idx) => {
                  const utilized = (customer.outstandingMinor / customer.creditLimitMinor) * 100;
                  return (
                    <Link key={customer.id} href={`/shop/customers/${customer.id}`}>
                      <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold">{idx + 1}. {customer.name}</p>
                            <p className="text-sm text-gray-600">
                              Outstanding: {formatMoney(fromMinorUnits(customer.outstandingMinor))} / {formatMoney(fromMinorUnits(customer.creditLimitMinor))}
                            </p>
                          </div>
                          <Badge tone={utilized > 80 ? "danger" : utilized > 50 ? "warning" : "success"}>
                            {utilized.toFixed(0)}%
                          </Badge>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              utilized > 80 ? "bg-red-500" : utilized > 50 ? "bg-yellow-500" : "bg-green-500"
                            }`}
                            style={{ width: `${Math.min(utilized, 100)}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <p className="text-center text-gray-500 py-4">No customers with credit</p>
              )}
            </div>
          </Card>

          {/* Overdue Customers */}
          <Card className="p-6 border-l-4 border-red-500">
            <h2 className="text-lg font-bold mb-4 text-red-600">Overdue Customers (30+ days)</h2>
            <div className="space-y-3">
              {metrics.overdueCustomers.length ? (
                metrics.overdueCustomers.map((customer) => (
                  <Link key={customer.id} href={`/shop/customers/${customer.id}/statement`}>
                    <div className="p-4 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-red-900">{customer.name}</p>
                          <p className="text-sm text-red-700">
                            Outstanding: {formatMoney(fromMinorUnits(customer.outstandingMinor))}
                          </p>
                          <p className="text-xs text-red-600 mt-1">
                            Last activity: {customer.daysSinceLast} days ago
                          </p>
                        </div>
                        <Badge tone="danger">
                          {customer.daysSinceLast}d overdue
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-center text-gray-500 py-4">No overdue customers</p>
              )}
            </div>
          </Card>
        </div>

        {/* Summary Stats */}
        <Card className="p-6 mt-8">
          <h2 className="text-lg font-bold mb-4">Portfolio Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Credit Limit</p>
              <p className="text-lg font-bold mt-1">
                {formatMoney(fromMinorUnits(metrics.totalCreditLimit))}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Available Credit</p>
              <p className="text-lg font-bold mt-1 text-green-600">
                {formatMoney(
                  fromMinorUnits(metrics.totalCreditLimit - metrics.totalOutstanding)
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Overdue Percentage</p>
              <p className="text-lg font-bold mt-1 text-red-600">
                {metrics.totalOutstanding > 0
                  ? ((metrics.totalOverdue / metrics.totalOutstanding) * 100).toFixed(2)
                  : 0}
                %
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Customers with Overdue</p>
              <p className="text-lg font-bold mt-1">
                {metrics.overdueCustomerCount} / {metrics.customerCount}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
