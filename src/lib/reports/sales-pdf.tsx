import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

type SalesPdfReport = {
  businessName: string;
  period: string;
  totalSales: number;
  totalRevenue: string;
  items: Array<{ receipt: string; shop: string; date: string; items: number; payment: string; total: string }>;
};

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 10,
    color: "#111827",
    fontFamily: "Helvetica",
    backgroundColor: "#f8fafc",
  },
  header: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: "1 solid #e2e8f0",
  },
  titleRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#0f172a",
  },
  meta: {
    fontSize: 10,
    color: "#475569",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 10,
    color: "#64748b",
  },
  summaryGrid: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  summaryCard: {
    flexGrow: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#e0e7ff",
  },
  summaryLabel: {
    fontSize: 8,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0f172a",
  },
  tableContainer: {
    marginTop: 18,
  },
  tableHeader: {
    display: "flex",
    flexDirection: "row",
    backgroundColor: "#1f2937",
    padding: 10,
    borderRadius: 8,
  },
  tableHeaderText: {
    color: "#f8fafc",
    fontSize: 9,
    fontWeight: 700,
  },
  tableRow: {
    display: "flex",
    flexDirection: "row",
    padding: 10,
    borderBottom: "1 solid #e2e8f0",
    backgroundColor: "#ffffff",
  },
  tableRowAlt: {
    backgroundColor: "#f8fafc",
  },
  cell: {
    fontSize: 9,
    color: "#0f172a",
  },
  receipt: { width: "20%" },
  shop: { width: "20%" },
  date: { width: "20%" },
  items: { width: "15%" },
  payment: { width: "25%" },
});

export function SalesReportPdf({ report }: { report: SalesPdfReport }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{report.businessName}</Text>
            <Text style={styles.meta}>Generated on {new Date().toLocaleDateString("en-KE")}</Text>
          </View>
          <Text style={styles.subtitle}>Sales Report — {report.period}</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total sales</Text>
              <Text style={styles.summaryValue}>{report.totalSales}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total revenue</Text>
              <Text style={styles.summaryValue}>{report.totalRevenue}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.receipt]}>Receipt</Text>
            <Text style={[styles.tableHeaderText, styles.shop]}>Shop</Text>
            <Text style={[styles.tableHeaderText, styles.date]}>Date</Text>
            <Text style={[styles.tableHeaderText, styles.items]}>Items</Text>
            <Text style={[styles.tableHeaderText, styles.payment]}>Payment / Total</Text>
          </View>
          {report.items.map((item, index) => (
            <View
              key={`${item.receipt}-${index}`}
              style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
            >
              <Text style={[styles.cell, styles.receipt]}>{item.receipt}</Text>
              <Text style={[styles.cell, styles.shop]}>{item.shop}</Text>
              <Text style={[styles.cell, styles.date]}>{item.date}</Text>
              <Text style={[styles.cell, styles.items]}>{item.items}</Text>
              <Text style={[styles.cell, styles.payment]}>{item.payment} · {item.total}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
