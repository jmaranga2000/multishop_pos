import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

type ProductRow = { productName: string; quantity: number; revenue: number };

type StockRow = { productName: string; status: "OUT_OF_STOCK" | "CRITICAL" | "LOW_STOCK" | "IN_STOCK" };

export type DailySnapshotPdfData = {
  shopName: string;
  dateTitle: string;
  generatedAt: string;
  totalSalesCount: number;
  totalRevenue: number;
  totalProfit: number;
  totalExpenses: number;
  variance: number | null;
  openedAt?: string | null;
  closedAt?: string | null;
  bestSellers: ProductRow[];
  worstSellers: ProductRow[];
  criticalProducts: StockRow[];
  lowProducts: StockRow[];
};

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10, fontFamily: "Helvetica", color: "#111827", backgroundColor: "#ffffff" },
  header: { marginBottom: 12 },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 9, color: "#475569" },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6 },
  row: { display: "flex", flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  small: { fontSize: 9 },
  table: { width: "100%", borderTop: "1 solid #e5e7eb", marginTop: 6 },
  tableHeader: { display: "flex", flexDirection: "row", backgroundColor: "#111827", color: "#fff", padding: 6 },
  cell: { fontSize: 9, padding: 4 },
  wide: { width: "50%" },
  narrow: { width: "25%" },
});

export function DailySnapshotPdf({ report }: { report: DailySnapshotPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{report.shopName}</Text>
          <Text style={styles.meta}>{report.dateTitle} — generated {report.generatedAt}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.row}><Text style={styles.small}>Sales count</Text><Text style={styles.small}>{report.totalSalesCount}</Text></View>
          <View style={styles.row}><Text style={styles.small}>Revenue</Text><Text style={styles.small}>{report.totalRevenue.toFixed(0)}</Text></View>
          <View style={styles.row}><Text style={styles.small}>Profit</Text><Text style={styles.small}>{report.totalProfit.toFixed(0)}</Text></View>
          <View style={styles.row}><Text style={styles.small}>Expenses</Text><Text style={styles.small}>{report.totalExpenses.toFixed(0)}</Text></View>
          <View style={styles.row}><Text style={styles.small}>Variance</Text><Text style={styles.small}>{report.variance === null ? "—" : report.variance.toFixed(2)}</Text></View>
          <View style={styles.row}><Text style={styles.small}>Opened</Text><Text style={styles.small}>{report.openedAt ?? "—"}</Text></View>
          <View style={styles.row}><Text style={styles.small}>Closed</Text><Text style={styles.small}>{report.closedAt ?? "—"}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Best sellers</Text>
          <View style={styles.table}>
            {report.bestSellers.map((p, i) => (
              <View key={`${p.productName}-${i}`} style={styles.row}>
                <Text style={[styles.cell, styles.wide]}>{p.productName}</Text>
                <Text style={[styles.cell, styles.narrow]}>{p.quantity}</Text>
                <Text style={[styles.cell, styles.narrow]}>{p.revenue.toFixed(0)}</Text>
              </View>
            ))}
            {report.bestSellers.length === 0 ? <Text style={styles.small}>No sales recorded</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Worst sellers</Text>
          <View style={styles.table}>
            {report.worstSellers.map((p, i) => (
              <View key={`${p.productName}-${i}`} style={styles.row}>
                <Text style={[styles.cell, styles.wide]}>{p.productName}</Text>
                <Text style={[styles.cell, styles.narrow]}>{p.quantity}</Text>
                <Text style={[styles.cell, styles.narrow]}>{p.revenue.toFixed(0)}</Text>
              </View>
            ))}
            {report.worstSellers.length === 0 ? <Text style={styles.small}>No sales recorded</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stock alerts</Text>
          <Text style={styles.small}>Critical products</Text>
          {report.criticalProducts.length ? report.criticalProducts.map((s, i) => <Text key={`c-${i}`} style={styles.small}>{s.productName}</Text>) : <Text style={styles.small}>None</Text>}
          <Text style={[styles.small, { marginTop: 6 }]}>Low stock products</Text>
          {report.lowProducts.length ? report.lowProducts.map((s, i) => <Text key={`l-${i}`} style={styles.small}>{s.productName}</Text>) : <Text style={styles.small}>None</Text>}
        </View>

      </Page>
    </Document>
  );
}
