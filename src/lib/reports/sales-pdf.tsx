import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

type SalesPdfReport = {
  businessName: string;
  period: string;
  totalSales: number;
  totalRevenue: string;
  items: Array<{ receipt: string; shop: string; date: string; items: number; payment: string; total: string }>;
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, color: "#172033" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 8 },
  subtitle: { color: "#667085", marginBottom: 12 },
  summaryRow: { display: "flex", flexDirection: "row", gap: 10, marginBottom: 14 },
  summaryCard: { border: "1 solid #d8dee9", borderRadius: 5, padding: 8, flexGrow: 1 },
  summaryLabel: { fontSize: 7, color: "#667085", textTransform: "uppercase" },
  summaryValue: { fontSize: 14, fontWeight: 700, marginTop: 3 },
  tableHeader: { display: "flex", flexDirection: "row", backgroundColor: "#eef3ff", padding: 6, fontWeight: 700 },
  tableRow: { display: "flex", flexDirection: "row", padding: 6, borderBottom: "1 solid #e8ebf0" },
  c1: { width: "20%" },
  c2: { width: "20%" },
  c3: { width: "20%" },
  c4: { width: "15%" },
  c5: { width: "25%" },
});

export function SalesReportPdf({ report }: { report: SalesPdfReport }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{report.businessName} — Sales Report</Text>
        <Text style={styles.subtitle}>{report.period}</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total sales</Text>
            <Text style={styles.summaryValue}>{report.totalSales}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total revenue</Text>
            <Text style={styles.summaryValue}>{report.totalRevenue}</Text>
          </View>
        </View>
        <View style={styles.tableHeader}>
          <Text style={styles.c1}>Receipt</Text>
          <Text style={styles.c2}>Shop</Text>
          <Text style={styles.c3}>Date</Text>
          <Text style={styles.c4}>Items</Text>
          <Text style={styles.c5}>Payment / Total</Text>
        </View>
        {report.items.map((item, index) => (
          <View key={`${item.receipt}-${index}`} style={styles.tableRow}>
            <Text style={styles.c1}>{item.receipt}</Text>
            <Text style={styles.c2}>{item.shop}</Text>
            <Text style={styles.c3}>{item.date}</Text>
            <Text style={styles.c4}>{item.items}</Text>
            <Text style={styles.c5}>{item.payment} — {item.total}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
