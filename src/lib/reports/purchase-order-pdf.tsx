import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

type PurchaseOrderPdfProps = {
  orderNumber: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  shopName: string;
  supplierName: string;
  supplierCompany?: string | null;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  notes?: string | null;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  items: Array<{ productName: string; unitName?: string | null; quantity: number; unitCost: number; taxRate: number; lineTotal: number }>;
};

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", fontSize: 10, color: "#0f172a" },
  heading: { fontSize: 22, fontWeight: 700, marginBottom: 5 },
  muted: { color: "#475569", marginBottom: 16 },
  row: { display: "flex", flexDirection: "row", justifyContent: "space-between", gap: 14, marginBottom: 14 },
  panel: { flex: 1, padding: 10, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, backgroundColor: "#f8fafc" },
  label: { fontSize: 8, color: "#64748b", marginBottom: 3, textTransform: "uppercase" },
  value: { fontSize: 10, fontWeight: 700, marginBottom: 3 },
  table: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 6 },
  head: { display: "flex", flexDirection: "row", padding: 7, backgroundColor: "#eff6ff", borderBottomWidth: 1, borderBottomColor: "#dbeafe" },
  line: { display: "flex", flexDirection: "row", padding: 7, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  product: { flex: 2 }, cell: { flex: 1 },
  totals: { marginTop: 16, marginLeft: "auto", width: 220 },
  totalRow: { display: "flex", flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  grand: { fontSize: 12, fontWeight: 700, paddingTop: 7, borderTopWidth: 1, borderTopColor: "#0f172a" },
  notes: { marginTop: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0", color: "#475569" },
});

const money = (value: number) => `KES ${value.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PurchaseOrderPdf(props: PurchaseOrderPdfProps) {
  return <Document><Page size="A4" style={styles.page}>
    <Text style={styles.heading}>Purchase Order</Text><Text style={styles.muted}>{props.orderNumber} · Issued {props.orderDate}</Text>
    <View style={styles.row}><View style={styles.panel}><Text style={styles.label}>Ordering shop</Text><Text style={styles.value}>{props.shopName}</Text><Text style={styles.label}>Expected delivery</Text><Text>{props.expectedDeliveryDate || "To be confirmed"}</Text></View><View style={styles.panel}><Text style={styles.label}>Supplier</Text><Text style={styles.value}>{props.supplierName}</Text>{props.supplierCompany ? <Text>{props.supplierCompany}</Text> : null}{props.supplierEmail ? <Text>{props.supplierEmail}</Text> : null}{props.supplierPhone ? <Text>{props.supplierPhone}</Text> : null}</View></View>
    <View style={styles.table}><View style={styles.head}><Text style={styles.product}>Product</Text><Text style={styles.cell}>Quantity</Text><Text style={styles.cell}>Unit cost</Text><Text style={styles.cell}>VAT</Text><Text style={styles.cell}>Line total</Text></View>{props.items.map((item, index) => <View key={`${item.productName}-${index}`} style={styles.line}><Text style={styles.product}>{item.productName}{item.unitName ? ` (${item.unitName})` : ""}</Text><Text style={styles.cell}>{item.quantity}</Text><Text style={styles.cell}>{money(item.unitCost)}</Text><Text style={styles.cell}>{item.taxRate}%</Text><Text style={styles.cell}>{money(item.lineTotal)}</Text></View>)}</View>
    <View style={styles.totals}><View style={styles.totalRow}><Text>Subtotal</Text><Text>{money(props.subtotal)}</Text></View><View style={styles.totalRow}><Text>Tax</Text><Text>{money(props.taxTotal)}</Text></View><View style={[styles.totalRow, styles.grand]}><Text>Grand total</Text><Text>{money(props.grandTotal)}</Text></View></View>
    {props.notes ? <View style={styles.notes}><Text style={styles.label}>Notes</Text><Text>{props.notes}</Text></View> : null}
  </Page></Document>;
}