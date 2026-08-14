"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatMoney, fromMinorUnits } from "@/lib/utils";
import { Download, ChevronLeft } from "lucide-react";
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
  shop?: {
    id: string;
    name: string;
    code: string;
  };
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

export default function AdminCustomerStatementPage() {
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
          `/api/admin/customers/${customerId}/statement`
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
      page: {
        padding: 40,
        fontFamily: "Helvetica",
        backgroundColor: "#ffffff",
      },
      header: {
        marginBottom: 30,
        borderBottomWidth: 2,
        borderBottomColor: "#173b89",
        paddingBottom: 15,
      },
      headerTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 10,
      },
      companyName: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#173b89",
      },
      statementTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
        textAlign: "right",
      },
      generatedDate: {
        fontSize: 9,
        color: "#666",
        textAlign: "right",
        marginTop: 5,
      },
      divider: {
        borderBottomWidth: 1,
        borderBottomColor: "#ddd",
        marginVertical: 15,
      },
      section: {
        marginBottom: 20,
      },
      sectionTitle: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#173b89",
        marginBottom: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      },
      twoColumnRow: {
        flexDirection: "row",
        gap: 40,
        marginBottom: 10,
      },
      infoBlock: {
        flex: 1,
      },
      infoLabel: {
        fontSize: 9,
        color: "#666",
        marginBottom: 3,
      },
      infoValue: {
        fontSize: 11,
        fontWeight: "bold",
        color: "#333",
      },
      summaryGrid: {
        flexDirection: "row",
        gap: 20,
        marginBottom: 15,
      },
      summaryBox: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#e0e0e0",
        padding: 10,
        borderRadius: 4,
        backgroundColor: "#f9f9f9",
      },
      summaryLabel: {
        fontSize: 8,
        color: "#666",
        marginBottom: 5,
      },
      summaryValue: {
        fontSize: 13,
        fontWeight: "bold",
        color: "#173b89",
      },
      warningValue: {
        fontSize: 13,
        fontWeight: "bold",
        color: "#dc2626",
      },
      tableHeader: {
        flexDirection: "row",
        backgroundColor: "#173b89",
        color: "#fff",
        paddingVertical: 8,
        paddingHorizontal: 5,
        marginBottom: 0,
      },
      tableHeaderCell: {
        fontSize: 9,
        fontWeight: "bold",
        color: "#fff",
      },
      tableRow: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#e0e0e0",
        paddingVertical: 6,
        paddingHorizontal: 5,
      },
      tableRowAlternate: {
        backgroundColor: "#f9f9f9",
      },
      tableCell: {
        fontSize: 9,
        color: "#333",
      },
      tableCellRight: {
        fontSize: 9,
        color: "#333",
        textAlign: "right",
      },
      footerRow: {
        flexDirection: "row",
        borderTopWidth: 2,
        borderTopColor: "#173b89",
        borderBottomWidth: 2,
        borderBottomColor: "#173b89",
        paddingVertical: 8,
        paddingHorizontal: 5,
        backgroundColor: "#f0f4f8",
      },
      footerCell: {
        fontSize: 10,
        fontWeight: "bold",
        color: "#173b89",
        textAlign: "right",
      },
      footer: {
        marginTop: 30,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: "#ddd",
        fontSize: 8,
        color: "#666",
        textAlign: "center",
      },
      colDate: { width: "12%" },
      colType: { width: "15%" },
      colDesc: { width: "28%" },
      colDebit: { width: "15%" },
      colCredit: { width: "15%" },
      colBalance: { width: "15%" },
    });

    const dateFormatted = new Date().toLocaleDateString("en-KE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const totalDebit = filteredEntries?.reduce((sum, e) => sum + e.debitMinor, 0) || 0;
    const totalCredit = filteredEntries?.reduce((sum, e) => sum + e.creditMinor, 0) || 0;

    const StatementPDF = (
      <Document>
        <Page style={styles.page} size="A4">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.companyName}>MULTISHOP POS</Text>
              <View>
                <Text style={styles.statementTitle}>CUSTOMER STATEMENT</Text>
                <Text style={styles.generatedDate}>
                  Generated on {dateFormatted}
                </Text>
              </View>
            </View>
          </View>

          {/* Customer Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            <View style={styles.twoColumnRow}>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Customer Name</Text>
                <Text style={styles.infoValue}>
                  {statement.customer.name}
                </Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Shop</Text>
                <Text style={styles.infoValue}>
                  {statement.customer.shop?.name} ({statement.customer.shop?.code})
                </Text>
              </View>
            </View>
            <View style={styles.twoColumnRow}>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>
                  {statement.customer.phone || "N/A"}
                </Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>
                  {statement.customer.email || "N/A"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Summary Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Summary</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Credit Limit</Text>
                <Text style={styles.summaryValue}>
                  KES {(statement.customer.creditLimit / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Outstanding Balance</Text>
                <Text style={styles.warningValue}>
                  KES{" "}
                  {(statement.customer.cachedOutstandingMinor / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Available Credit</Text>
                <Text style={styles.summaryValue}>
                  KES{" "}
                  {(
                    (statement.customer.creditLimit -
                      statement.customer.cachedOutstandingMinor) /
                    100
                  ).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          {/* Aged Balance */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Aged Balance Breakdown</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Current (0-30 days)</Text>
                <Text style={styles.summaryValue}>
                  KES {(statement.agedBalance.current / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>30-60 days</Text>
                <Text style={styles.summaryValue}>
                  KES {(statement.agedBalance.thirtyPlus / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>60-90 days</Text>
                <Text style={styles.summaryValue}>
                  KES {(statement.agedBalance.sixtyPlus / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Over 90 days</Text>
                <Text style={styles.warningValue}>
                  KES {(statement.agedBalance.ninetyPlus / 100).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          {/* Ledger Entries Table */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
            <View>
              <View style={styles.tableHeader}>
                <Text
                  style={[styles.tableHeaderCell, styles.colDate]}
                >
                  Date
                </Text>
                <Text
                  style={[styles.tableHeaderCell, styles.colType]}
                >
                  Type
                </Text>
                <Text
                  style={[styles.tableHeaderCell, styles.colDesc]}
                >
                  Description
                </Text>
                <Text
                  style={[styles.tableHeaderCell, styles.colDebit]}
                >
                  Debit
                </Text>
                <Text
                  style={[styles.tableHeaderCell, styles.colCredit]}
                >
                  Credit
                </Text>
                <Text
                  style={[styles.tableHeaderCell, styles.colBalance]}
                >
                  Balance
                </Text>
              </View>

              {filteredEntries?.map((entry, idx) => (
                <View
                  key={entry.id}
                  style={[
                    styles.tableRow,
                    idx % 2 === 0 ? styles.tableRowAlternate : {},
                  ]}
                >
                  <Text style={[styles.tableCell, styles.colDate]}>
                    {new Date(entry.occurredAt).toLocaleDateString("en-KE")}
                  </Text>
                  <Text style={[styles.tableCell, styles.colType]}>
                    {entry.type
                      .replace(/_/g, " ")
                      .toLowerCase()
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Text>
                  <Text style={[styles.tableCell, styles.colDesc]}>
                    {entry.description || "-"}
                  </Text>
                  <Text style={[styles.tableCellRight, styles.colDebit]}>
                    {entry.debitMinor > 0
                      ? `KES ${(entry.debitMinor / 100).toFixed(2)}`
                      : "-"}
                  </Text>
                  <Text style={[styles.tableCellRight, styles.colCredit]}>
                    {entry.creditMinor > 0
                      ? `KES ${(entry.creditMinor / 100).toFixed(2)}`
                      : "-"}
                  </Text>
                  <Text style={[styles.tableCellRight, styles.colBalance]}>
                    KES {(entry.runningBalanceMinor / 100).toFixed(2)}
                  </Text>
                </View>
              ))}

              {/* Footer Row */}
              <View style={styles.footerRow}>
                <Text style={[styles.footerCell, styles.colDate]}>TOTAL</Text>
                <Text style={[styles.footerCell, styles.colType]}></Text>
                <Text style={[styles.footerCell, styles.colDesc]}></Text>
                <Text style={[styles.footerCell, styles.colDebit]}>
                  KES {(totalDebit / 100).toFixed(2)}
                </Text>
                <Text style={[styles.footerCell, styles.colCredit]}>
                  KES {(totalCredit / 100).toFixed(2)}
                </Text>
                <Text style={[styles.footerCell, styles.colBalance]}>
                  KES{" "}
                  {(statement.customer.cachedOutstandingMinor / 100).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text>
              This is an electronically generated statement. No signature
              required.
            </Text>
            <Text>For inquiries, please contact your business administrator.</Text>
          </View>
        </Page>
      </Document>
    ) as any;

    try {
      const buffer = await renderToBuffer(StatementPDF);
      const blob = new Blob([buffer as unknown as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Statement-${statement.customer.name.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Failed to generate PDF. Please try again.");
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
            <Link href={`/admin/customers/${customerId}`}>
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
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-4">
            <p className="text-sm text-gray-600">Customer Name</p>
            <p className="text-lg font-bold">{statement.customer.name}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600">Shop</p>
            <p className="text-lg font-bold">
              {statement.customer.shop?.name}
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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="p-4">
            <p className="text-sm text-gray-600">Credit Limit</p>
            <p className="text-lg font-bold">
              {formatMoney(
                fromMinorUnits(statement.customer.creditLimit)
              )}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600">Available Credit</p>
            <p className="text-lg font-bold text-green-600">
              {formatMoney(
                fromMinorUnits(
                  statement.customer.creditLimit -
                    statement.customer.cachedOutstandingMinor
                )
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
              <p className="text-lg font-bold text-red-600">
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
