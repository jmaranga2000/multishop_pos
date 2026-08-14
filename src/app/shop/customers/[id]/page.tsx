"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatMoney, fromMinorUnits } from "@/lib/utils";
import { ChevronLeft, Send } from "lucide-react";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  creditLimit: number;
  cachedOutstandingMinor: number;
  lastTransactionAt: string | null;
}

interface PaymentInput {
  method: "CASH" | "MPESA" | "CARD" | "BANK_TRANSFER";
  amountMinor: number;
  reference?: string;
}

export default function CustomerDetailsPage() {
  const params = useParams();
  const customerId = params.id as string;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentInput["method"]>("CASH");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchCustomer() {
      try {
        const res = await fetch(`/api/shop/customers/${customerId}`);
        if (!res.ok) throw new Error("Failed to fetch customer");
        const data = await res.json();
        setCustomer(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchCustomer();
  }, [customerId]);

  const handleRecordPayment = async () => {
    if (!customer || !paymentAmount) {
      toast.error("Please enter a payment amount");
      return;
    }

    const amountMinor = Math.round(Number(paymentAmount) * 100);
    if (amountMinor <= 0) {
      toast.error("Payment amount must be greater than zero");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/shop/customers/${customerId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: paymentMethod,
          amountMinor,
          reference: paymentReference || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to record payment");
      }

      const updatedCustomer = await res.json();
      setCustomer(updatedCustomer);
      setPaymentAmount("");
      setPaymentReference("");
      toast.success(`Payment of ${formatMoney(fromMinorUnits(amountMinor))} recorded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 min-h-screen">
        <div className="max-w-2xl mx-auto">
          <Card className="p-6">Loading customer details...</Card>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-6 min-h-screen">
        <div className="max-w-2xl mx-auto">
          <Link href="/shop/customers">
            <Button variant="secondary" size="sm" className="mb-4">
              <ChevronLeft className="h-4 w-4" />
              Back to customers
            </Button>
          </Link>
          <Card className="p-6 text-red-600">
            {error || "Customer not found"}
          </Card>
        </div>
      </div>
    );
  }

  const availableCredit = customer.creditLimit - customer.cachedOutstandingMinor;
  const utilizationPercent = customer.creditLimit > 0
    ? Math.round((customer.cachedOutstandingMinor / customer.creditLimit) * 100)
    : 0;

  return (
    <div className="p-6 min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto">
        <Link href="/shop/customers">
          <Button variant="secondary" size="sm" className="mb-4">
            <ChevronLeft className="h-4 w-4" />
            Back to customers
          </Button>
        </Link>

        {/* Customer Info */}
        <Card className="p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">{customer.name}</h1>
              <p className="text-slate-600 mt-1">
                {customer.phone && <span>{customer.phone} • </span>}
                {customer.email || "No contact info"}
              </p>
            </div>
            <Link href={`/shop/customers/${customer.id}/statement`}>
              <Button variant="secondary">View Statement</Button>
            </Link>
          </div>

          {/* Credit Summary */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="border-l-4 border-red-500 pl-4">
              <p className="text-sm text-slate-600">Outstanding</p>
              <p className="text-2xl font-bold text-red-600">
                {formatMoney(fromMinorUnits(customer.cachedOutstandingMinor))}
              </p>
            </div>
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-sm text-slate-600">Credit Limit</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatMoney(fromMinorUnits(customer.creditLimit))}
              </p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <p className="text-sm text-slate-600">Available</p>
              <p className="text-2xl font-bold text-green-600">
                {formatMoney(fromMinorUnits(availableCredit))}
              </p>
            </div>
          </div>

          {/* Utilization Bar */}
          {customer.creditLimit > 0 && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-600">Credit Utilization</span>
                <Badge tone={utilizationPercent > 80 ? "danger" : utilizationPercent > 50 ? "warning" : "success"}>
                  {utilizationPercent}%
                </Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    utilizationPercent > 80
                      ? "bg-red-500"
                      : utilizationPercent > 50
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                />
              </div>
            </div>
          )}

          {customer.lastTransactionAt && (
            <p className="text-xs text-slate-500 mt-4">
              Last transaction: {new Date(customer.lastTransactionAt).toLocaleString()}
            </p>
          )}
        </Card>

        {/* Record Payment */}
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-4">Record Payment</h2>
          
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentInput["method"])}
                disabled={submitting}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="CASH">Cash</option>
                <option value="MPESA">M-Pesa</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Amount</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                disabled={submitting}
              />
            </div>

            {(paymentMethod === "MPESA" || paymentMethod === "BANK_TRANSFER") && (
              <div>
                <label className="mb-1 block text-sm font-medium">Reference / Transaction ID</label>
                <Input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g., Transaction ID"
                  disabled={submitting}
                />
              </div>
            )}

            <Button
              onClick={handleRecordPayment}
              disabled={submitting || !paymentAmount}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {submitting ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
