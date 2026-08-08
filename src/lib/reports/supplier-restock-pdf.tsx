import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

type SupplierRestockPdfProps = {
  shopName: string;
  supplierName: string;
  supplierCompany: string;
  supplierEmail: string;
  supplierPhone: string;
  shopAddress?: string | null;
  referenceNumber: string;
  products: Array<{
    productName: string;
    currentQuantity: number;
    quantityNeeded: number;
    unit: string;
  }>;
  generatedAt: string;
};

const styles = StyleSheet.create({
  page: { padding: 24, fontFamily: "Helvetica", fontSize: 10, color: "#111827" },
  headerRow: { display: "flex", flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 8 },
  subtitle: { fontSize: 11, color: "#475569", marginBottom: 20 },
  block: { marginBottom: 16 },
  label: { fontSize: 9, color: "#475569", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 },
  value: { fontSize: 11, fontWeight: 700, color: "#111827" },
  row: { display: "flex", flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  twoColumn: { display: "flex", flexDirection: "row", gap: 12, flexWrap: "wrap" },
  card: { flex: 1, minWidth: 260, padding: 10, borderRadius: 10, backgroundColor: "#f8fafc", border: "1 solid #e2e8f0" },
  table: { width: "100%", borderWidth: 1, borderColor: "#e2e8f0", borderStyle: "solid", borderRadius: 8, overflow: "hidden" },
  tableHeader: { display: "flex", flexDirection: "row", backgroundColor: "#eff6ff", padding: 8, borderBottomWidth: 1, borderBottomColor: "#dbeafe" },
  tableHeaderCell: { fontSize: 8, fontWeight: 700, color: "#0f172a", flex: 1 },
  tableRow: { display: "flex", flexDirection: "row", padding: 8, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  tableCell: { fontSize: 9, color: "#0f172a", flex: 1 },
  footer: { marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#e2e8f0", color: "#475569", fontSize: 9 },
});

export function SupplierRestockPdf({
  shopName,
  supplierName,
  supplierCompany,
  supplierEmail,
  supplierPhone,
  shopAddress,
  referenceNumber,
  products,
  generatedAt,
}: SupplierRestockPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Purchase Requisition</Text>
            <Text style={styles.subtitle}>Automatically generated restock request for {shopName}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Reference number</Text>
            <Text style={styles.value}>{referenceNumber}</Text>
            <Text style={styles.label}>Generated</Text>
            <Text style={styles.value}>{generatedAt}</Text>
          </View>
        </View>

        <View style={styles.twoColumn}>
          <View style={styles.card}>
            <Text style={styles.label}>Shop</Text>
            <Text style={styles.value}>{shopName}</Text>
            {shopAddress ? <Text style={styles.value}>{shopAddress}</Text> : null}
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Supplier</Text>
            <Text style={styles.value}>{supplierName}</Text>
            <Text style={styles.value}>{supplierCompany}</Text>
            <Text style={styles.value}>{supplierEmail}</Text>
            <Text style={styles.value}>{supplierPhone}</Text>
          </View>
        </View>

        <View style={{ marginTop: 16, marginBottom: 8 }}>
          <Text style={styles.label}>Products requested</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderCell}>Product</Text>
            <Text style={styles.tableHeaderCell}>Needed</Text>
            <Text style={styles.tableHeaderCell}>Stock</Text>
            <Text style={styles.tableHeaderCell}>Unit</Text>
          </View>
          {products.map((product, index) => (
            <View key={`${product.productName}-${index}`} style={styles.tableRow}>
              <Text style={styles.tableCell}>{product.productName}</Text>
              <Text style={styles.tableCell}>{product.quantityNeeded}</Text>
              <Text style={styles.tableCell}>{product.currentQuantity}</Text>
              <Text style={styles.tableCell}>{product.unit}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>Generated automatically by POS</Text>
          <Text>Please arrange delivery at your earliest convenience.</Text>
        </View>
      </Page>
    </Document>
  );
}
