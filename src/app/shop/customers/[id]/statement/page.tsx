"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatMoney, fromMinorUnits } from "@/lib/utils";
import { Download, Printer, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";

interface LedgerEntry {
  id: string;
  type: string;
  occurredAt: string;
  description: string;
  debitMinor: number;
  creditMinor: number;
  runningBalanceMinor: number;
  reference: string | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  creditLimit: number;
  cachedOutstandingMinor: number;
  lastTransactionAt: string | null;
}

interface StatementData {
  customer: Customer;
  ledgerEntries: LedgerEntry[];
  agedBalance: {
    current: number;
    thirtyPlus: number;
    sixtyPlus: number;
    ninetyPlus: number;
  };
}

export default function CustomerStatementPage() {
  const params = useParams();
  const customerId = params.id as string;
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    async function fetchStatement() {
      try {
        const res = await fetch(
          `/api/shop/customers/${customerId}/statement`
        );
        if (!res.ok) throw new Error("Failed to fetch statement");
        const data = await res.json();
        setStatement(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchStatement();
  }, [customerId]);

  const filteredEntries = statement?.ledgerEntries.filter((entry) => {
    if (filterType && entry.type !== filterType) return false;
    if (startDate && new Date(entry.occurredAt) < new Date(startDate))
      return false;
    if (endDate && new Date(entry.occurredAt) > new Date(endDate))
      return false;
    return true;
  });

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      CREDIT_SALE: "bg-red-100 text-red-800",
      CUSTOMER_PAYMENT: "bg-green-100 text-green-800",
      CUSTOMER_REFUND: "bg-blue-100 text-blue-800",
      DEBIT_ADJUSTMENT: "bg-yellow-100 text-yellow-800",
      CREDIT_ADJUSTMENT: "bg-purple-100 text-purple-800",
      PRODUCT_RETURN: "bg-pink-100 text-pink-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  async function handleExportPDF() {
    if (!statement) return;

    const styles = StyleSheet.create({
      page: { padding: 40 },
      header: { marginBottom: 20, borderBottom: 1, paddingBottom: 10 },
      title: { fontSize: 18, fontWeight: "bold", marginBottom: 5 },
      subtitle: { fontSize: 12, color: "#666", marginBottom: 10 },
      section: { marginBottom: 20 },
      sectionTitle: { fontSize: 14, fontWeight: "bold", marginBottom: 10 },
      table: { marginBottom: 10 },
      tableRow: { flexDirection: "row", marginBottom: 5, borderBottom: 1 },
      tableHeader: { flexDirection: "row", marginBottom: 10, fontWeight: "bold" },
      col1: { width: "15%" },
      col2: { width: "20%" },
      col3: { width: "30%" },
      col4: { width: "15%" },
      col5: { width: "20%" },
      text: { fontSize: 10 },
      textSmall: { fontSize: 8, color: "#666" },
    });

    const StatementPDF = (
      <Document>
        <Page style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>
              Customer Statement
            </Text>
            <Text style={styles.subtitle}>
              {statement.customer.name}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            <Text style={styles.text}>
              Phone: {statement.customer.phone || "N/A"}
            </Text>
            <Text style={styles.text}>
              Email: {statement.customer.email || "N/A"}
            </Text>
            <Text style={styles.text}>
              Credit Limit: KES{" "}
              {(statement.customer.creditLimit / 100).toFixed(2)}
            </Text>
            <Text style={styles.text}>
              Outstanding Balance: KES{" "}
              {(statement.customer.cachedOutstandingMinor / 100).toFixed(2)}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Aged Balance</Text>
            <Text style={styles.text}>
              Current (0-30 days): KES{" "}
              {(statement.agedBalance.current / 100).toFixed(2)}
            </Text>
            <Text style={styles.text}>
              30-60 days: KES{" "}
              {(statement.agedBalance.thirtyPlus / 100).toFixed(2)}
            </Text>
            <Text style={styles.text}>
              60-90 days: KES{" "}
              {(statement.agedBalance.sixtyPlus / 100).toFixed(2)}
            </Text>
            <Text style={styles.text}>
              Over 90 days: KES{" "}
              {(statement.agedBalance.ninetyPlus / 100).toFixed(2)}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ledger Entries</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.col1, styles.text]}>Date</Text>
              <Text style={[styles.col2, styles.text]}>Type</Text>
              <Text style={[styles.col3, styles.text]}>Description</Text>
              <Text style={[styles.col4, styles.text]}>Amount</Text>
              <Text style={[styles.col5, styles.text]}>Balance</Text>
            </View>
            {filteredEntries?.map((entry) => (
              <View key={entry.id} style={styles.tableRow}>
                <Text style={[styles.col1, styles.text]}>
                  {new Date(entry.occurredAt).toLocaleDateString()}
                </Text>
                <Text style={[styles.col2, styles.text]}>{entry.type}</Text>
                <Text style={[styles.col3, styles.text]}>
                  {entry.description}
                </Text>
                <Text style={[styles.col4, styles.text]}>
                  {entry.debitMinor > 0
                    ? `+KES ${(entry.debitMinor / 100).toFixed(2)}`
                    : `-KES ${(entry.creditMinor / 100).toFixed(2)}`}
                </Text>
                <Text style={[styles.col5, styles.text]}>
                  KES {(entry.runningBalanceMinor / 100).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </Page>
      </Document>
    ) as any;

    try {
      const buffer = await renderToBuffer(StatementPDF);
      const blob = new Blob([buffer as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `statement-${statement.customer.name}-${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
    }
  }

  if (loading) return <div className="p-6">Loading statement...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!statement) return <div className="p-6">Statement not found</div>;

  const totalDebit = filteredEntries?.reduce((sum, e) => sum + e.debitMinor, 0) || 0;
  const totalCredit = filteredEntries?.reduce((sum, e) => sum + e.creditMinor, 0) || 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/shop/customers">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Customer Statement</h1>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleExportPDF}
              variant="secondary"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Customer Info Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="p-4">
            <p className="text-sm text-gray-600">Customer Name</p>
            <p className="text-lg font-bold">{statement.customer.name}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600">Phone</p>
            <p className="text-lg font-bold">
              {statement.customer.phone || "N/A"}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600">Credit Limit</p>
            <p className="text-lg font-bold">
              {formatMoney(
                fromMinorUnits(statement.customer.creditLimit)
              )}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600">Outstanding Balance</p>
            <p className="text-lg font-bold text-red-600">
              {formatMoney(
                fromMinorUnits(statement.customer.cachedOutstandingMinor)
              )}
            </p>
          </Card>
        </div>

        {/* Aged Balance */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Aged Balance</h2>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Current (0-30 days)</p>
              <p className="text-lg font-bold">
                {formatMoney(
                  fromMinorUnits(statement.agedBalance.current)
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">30-60 days</p>
              <p className="text-lg font-bold">
                {formatMoney(
                  fromMinorUnits(statement.agedBalance.thirtyPlus)
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">60-90 days</p>
              <p className="text-lg font-bold">
                {formatMoney(
                  fromMinorUnits(statement.agedBalance.sixtyPlus)
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">90+ days</p>
              <p className="text-lg font-bold">
                {formatMoney(
                  fromMinorUnits(statement.agedBalance.ninetyPlus)
                )}
              </p>
            </div>
          </div>
        </Card>

        {/* Filters */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Filters</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">All Types</option>
                <option value="CREDIT_SALE">Credit Sale</option>
                <option value="CUSTOMER_PAYMENT">Payment</option>
                <option value="DEBIT_ADJUSTMENT">Debit Adjustment</option>
                <option value="CREDIT_ADJUSTMENT">Credit Adjustment</option>
                <option value="PRODUCT_RETURN">Product Return</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                From Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                To Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Ledger Entries Table */}
        <Card className="p-6 overflow-x-auto">
          <h2 className="text-lg font-bold mb-4">Ledger Entries</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2">
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Type</th>
                <th className="text-left py-2">Description</th>
                <th className="text-right py-2">Debit</th>
                <th className="text-right py-2">Credit</th>
                <th className="text-right py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries?.length ? (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="border-b">
                    <td className="py-2">
                      {new Date(entry.occurredAt).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      <Badge className={getTypeColor(entry.type)}>
                        {entry.type}
                      </Badge>
                    </td>
                    <td className="py-2">{entry.description}</td>
                    <td className="text-right py-2">
                      {entry.debitMinor > 0
                        ? formatMoney(fromMinorUnits(entry.debitMinor))
                        : "-"}
                    </td>
                    <td className="text-right py-2">
                      {entry.creditMinor > 0
                        ? formatMoney(fromMinorUnits(entry.creditMinor))
                        : "-"}
                    </td>
                    <td className="text-right py-2 font-bold">
                      {formatMoney(
                        fromMinorUnits(entry.runningBalanceMinor)
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-gray-500">
                    No entries found
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-bold">
                <td colSpan={3} className="py-2">
                  Totals
                </td>
                <td className="text-right py-2">
                  {formatMoney(fromMinorUnits(totalDebit))}
                </td>
                <td className="text-right py-2">
                  {formatMoney(fromMinorUnits(totalCredit))}
                </td>
                <td className="text-right py-2">
                  {formatMoney(
                    fromMinorUnits(statement.customer.cachedOutstandingMinor)
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      </div>
    </div>
  );
}
