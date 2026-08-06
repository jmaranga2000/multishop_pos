import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

type RankingRow = {
  shopName: string;
  transactions: number;
  sales: number;
  profit: number;
  expenses: number;
  alerts: number;
};

type BestSeller = {
  productName: string;
  quantity: number;
  revenue: number;
};

type StockSummaryRow = {
  shopName: string;
  totalProducts: number;
  lowStockCount: number;
  criticalStockCount: number;
  outOfStockCount: number;
  inventoryValue: number;
};

export type WeeklyReportPdfData = {
  businessName: string;
  currency: string;
  periodTitle: string;
  generatedAt: string;
  totalSalesCount: number;
  totalRevenue: number;
  totalProfit: number;
  totalExpenses: number;
  totalNet: number;
  shopRankings: RankingRow[];
  bestSellersByShop: Array<{ shopName: string; products: BestSeller[] }>;
  stockSummary: StockSummaryRow[];
};

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1f2937",
    backgroundColor: "#f8fafc",
  },
  header: {
    marginBottom: 18,
  },
  titleRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 10,
    color: "#475569",
  },
  metadata: {
    fontSize: 9,
    color: "#64748b",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
    color: "#111827",
  },
  summaryGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    flexGrow: 1,
    minWidth: 130,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    border: "1 solid #e2e8f0",
    padding: 10,
  },
  cardLabel: {
    fontSize: 8,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0f172a",
  },
  positive: {
    color: "#047857",
  },
  negative: {
    color: "#b91c1c",
  },
  table: {
    width: "100%",
    borderRadius: 10,
    overflow: "hidden",
    border: "1 solid #e2e8f0",
    backgroundColor: "#ffffff",
  },
  tableHeader: {
    display: "flex",
    flexDirection: "row",
    backgroundColor: "#1e40af",
    padding: 8,
  },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: 700,
    color: "#f8fafc",
  },
  tableRow: {
    display: "flex",
    flexDirection: "row",
    padding: 8,
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
  wide: {
    width: "29%",
  },
  normal: {
    width: "14%",
  },
  small: {
    width: "10%",
  },
  bestSellerRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    padding: 8,
    borderBottom: "1 solid #e2e8f0",
  },
  bestSellerShop: {
    width: "28%",
    fontSize: 9,
    fontWeight: 700,
  },
  bestSellerCell: {
    width: "24%",
    fontSize: 9,
  },
  badge: {
    padding: 4,
    borderRadius: 6,
    fontSize: 8,
    fontWeight: 700,
    color: "#0f172a",
    backgroundColor: "#e0f2fe",
  },
});

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCount(value: number) {
  return value.toLocaleString("en-KE");
}

export function WeeklyInventoryReportPdf({ report }: { report: WeeklyReportPdfData }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{report.businessName}</Text>
            <Text style={styles.metadata}>Generated: {report.generatedAt}</Text>
          </View>
          <Text style={styles.subtitle}>Weekly performance snapshot — {report.periodTitle}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Completed sales</Text>
              <Text style={styles.cardValue}>{formatCount(report.totalSalesCount)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Revenue</Text>
              <Text style={styles.cardValue}>{formatCurrency(report.totalRevenue, report.currency)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Profit</Text>
              <Text style={[styles.cardValue, report.totalProfit >= 0 ? styles.positive : styles.negative]}>
                {formatCurrency(report.totalProfit, report.currency)}
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Expenses</Text>
              <Text style={styles.cardValue}>{formatCurrency(report.totalExpenses, report.currency)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Net result</Text>
              <Text style={[styles.cardValue, report.totalNet >= 0 ? styles.positive : styles.negative]}>
                {formatCurrency(report.totalNet, report.currency)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shop performance ranking</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.wide]}>Shop</Text>
              <Text style={[styles.tableHeaderText, styles.normal]}>Transactions</Text>
              <Text style={[styles.tableHeaderText, styles.normal]}>Sales</Text>
              <Text style={[styles.tableHeaderText, styles.normal]}>Profit</Text>
              <Text style={[styles.tableHeaderText, styles.normal]}>Expenses</Text>
              <Text style={[styles.tableHeaderText, styles.small]}>Alerts</Text>
            </View>
            {report.shopRankings.map((row, index) => (
              <View key={`${row.shopName}-${index}`} style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}>
                <Text style={[styles.cell, styles.wide]}>{row.shopName}</Text>
                <Text style={[styles.cell, styles.normal]}>{formatCount(row.transactions)}</Text>
                <Text style={[styles.cell, styles.normal]}>{formatCurrency(row.sales, report.currency)}</Text>
                <Text style={[styles.cell, styles.normal]}>{formatCurrency(row.profit, report.currency)}</Text>
                <Text style={[styles.cell, styles.normal]}>{formatCurrency(row.expenses, report.currency)}</Text>
                <Text style={[styles.cell, styles.small]}>{formatCount(row.alerts)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Best selling items by shop</Text>
          {report.bestSellersByShop.map((shop, shopIndex) => (
            <View key={`${shop.shopName}-${shopIndex}`} style={{ marginBottom: 10 }}>
              <Text style={styles.bestSellerShop}>{shop.shopName}</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, styles.wide]}>Product</Text>
                  <Text style={[styles.tableHeaderText, styles.normal]}>Qty sold</Text>
                  <Text style={[styles.tableHeaderText, styles.normal]}>Revenue</Text>
                </View>
                {shop.products.map((product, index) => (
                  <View key={`${product.productName}-${index}`} style={index % 2 === 1 ? [styles.bestSellerRow, styles.tableRowAlt] : styles.bestSellerRow}>
                    <Text style={[styles.bestSellerCell, { width: "52%" }]}>{product.productName}</Text>
                    <Text style={[styles.bestSellerCell, { width: "24%" }]}>{formatCount(product.quantity)}</Text>
                    <Text style={[styles.bestSellerCell, { width: "24%" }]}>{formatCurrency(product.revenue, report.currency)}</Text>
                  </View>
                ))}
                {shop.products.length === 0 ? (
                  <View style={styles.bestSellerRow}>
                    <Text style={[styles.bestSellerCell, { width: "100%" }]}>No sales recorded for this shop.</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stock summary by shop</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.wide]}>Shop</Text>
              <Text style={[styles.tableHeaderText, styles.normal]}>Products</Text>
              <Text style={[styles.tableHeaderText, styles.normal]}>Low</Text>
              <Text style={[styles.tableHeaderText, styles.normal]}>Critical</Text>
              <Text style={[styles.tableHeaderText, styles.normal]}>Out</Text>
              <Text style={[styles.tableHeaderText, styles.normal]}>Stock value</Text>
            </View>
            {report.stockSummary.map((row, index) => (
              <View key={`${row.shopName}-${index}`} style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}>
                <Text style={[styles.cell, styles.wide]}>{row.shopName}</Text>
                <Text style={[styles.cell, styles.normal]}>{formatCount(row.totalProducts)}</Text>
                <Text style={[styles.cell, styles.normal]}>{formatCount(row.lowStockCount)}</Text>
                <Text style={[styles.cell, styles.normal]}>{formatCount(row.criticalStockCount)}</Text>
                <Text style={[styles.cell, styles.normal]}>{formatCount(row.outOfStockCount)}</Text>
                <Text style={[styles.cell, styles.normal]}>{formatCurrency(row.inventoryValue, report.currency)}</Text>
              </View>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}
