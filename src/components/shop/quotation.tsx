import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

export type QuotationData = {
  shopName: string;
  shopContact?: string | null;
  shopLocation?: string | null;
  businessName?: string | null;
  quotationNumber: string;
  issuedAt: string;
  customerName: string;
  items: Array<{
    name: string;
    quantity: number;
    unitName?: string | null;
    unitSymbol?: string | null;
    unitPriceMinor: number;
    lineTotalMinor: number;
  }>;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  notes?: string | null;
};

function money(minor: number) {
  return `KES ${(minor / 100).toFixed(2)}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character));
}

export function buildQuotationHtml(data: QuotationData) {
  const rows = data.items.map((item) =>
     `<tr>
  <td>
  ${escapeHtml(item.name)}
  </td>
  <td>
  ${item.quantity}
  </td>
  <td>
  ${money(item.unitPriceMinor)}
  </td>
  <td>
  ${money(item.lineTotalMinor)}
  </td>
  </tr>`
).join("");
  return 
  `<!doctype html>
  <html>
  <head>
  <meta charset="utf-8">
  <title>
  Quotation ${escapeHtml(data.quotationNumber)}
  </title>
  <style>
  body
  {margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,sans-serif}.sheet{max-width:820px;margin:32px auto;background:#fff;padding:42px;box-shadow:0 12px 40px rgba(15,23,42,.12)}.topline{height:7px;background:#2563eb;margin:-42px -42px 34px}.brand{font-size:25px;font-weight:800}.muted{color:#64748b;font-size:12px}.title{margin-top:28px;font-size:30px;font-weight:900;letter-spacing:.04em;color:#1d4ed8}.meta{display:flex;justify-content:space-between;margin-top:24px;padding:16px 0;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0}.customer{margin-top:22px;font-size:14px}.customer strong{display:block;font-size:16px;margin-top:5px}table{width:100%;border-collapse:collapse;margin-top:28px}th{text-align:left;background:#eff6ff;color:#1e3a8a;font-size:11px;text-transform:uppercase;letter-spacing:.06em;padding:12px}td{border-bottom:1px solid #e2e8f0;padding:13px 12px;font-size:13px}td:nth-child(n+2),th:nth-child(n+2){text-align:right}.totals{margin:24px 0 0 auto;max-width:300px}.total{display:flex;justify-content:space-between;border-top:2px solid #1d4ed8;margin-top:10px;padding-top:12px;font-size:19px;font-weight:800}.notes{margin-top:32px;padding:14px;background:#f8fafc;color:#475569;font-size:12px}@media print{body{background:#fff}.sheet{margin:0;max-width:none;box-shadow:none}.actions{display:none}}</style></head><body><main class="sheet"><div class="topline"></div><div class="brand">${escapeHtml(data.shopName)}</div><div class="muted">${escapeHtml(data.shopContact ?? "")} ${data.shopLocation ? `• ${escapeHtml(data.shopLocation)}` : ""}</div><div class="title">QUOTATION</div><div class="meta"><span>Quotation no. <strong>${escapeHtml(data.quotationNumber)}</strong></span><span>Issued ${escapeHtml(new Date(data.issuedAt).toLocaleDateString("en-KE"))}</span></div><div class="customer">Prepared for<strong>${escapeHtml(data.customerName || "Walk-in customer")}</strong></div><table><thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div style="display:flex;justify-content:space-between"><span>Subtotal</span><strong>${money(data.subtotalMinor)}</strong></div>${data.discountMinor > 0 ? `<div style="display:flex;justify-content:space-between;margin-top:7px"><span>Discount</span><strong>-${money(data.discountMinor)}</strong></div>` : ""}<div class="total"><span>Estimated total</span><span>${money(data.totalMinor)}</span></div></div>${data.notes ? `<div class="notes"><strong>Notes</strong><br>${escapeHtml(data.notes)}</div>` : ""}</main></body></html>`;
}

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: "Helvetica", fontSize: 10, color: "#0f172a" },
  line: { height: 6, backgroundColor: "#2563eb", marginBottom: 28 },
  brand: { fontSize: 22, fontWeight: 700 },
  muted: { color: "#64748b", marginTop: 4 },
  title: { color: "#1d4ed8", fontSize: 26, fontWeight: 700, marginTop: 25 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingBottom: 12 },
  tableHeader: { flexDirection: "row", backgroundColor: "#eff6ff", marginTop: 24, padding: 9 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", padding: 9 },
  product: { flex: 2 },
  cell: { flex: 1, textAlign: "right" },
  total: { borderTopWidth: 2, borderTopColor: "#1d4ed8", paddingTop: 10, marginTop: 10, fontSize: 14, fontWeight: 700 },
  notes: { marginTop: 28, backgroundColor: "#f8fafc", padding: 12, color: "#475569" },
});

export function QuotationPdfDocument({ data }: { data: QuotationData }) {
  return <Document><Page size="A4" style={styles.page}><View style={styles.line} /><Text style={styles.brand}>{data.shopName}</Text><Text style={styles.muted}>{data.shopContact ?? ""}{data.shopLocation ? ` • ${data.shopLocation}` : ""}</Text><Text style={styles.title}>QUOTATION</Text><View style={[styles.row, styles.divider]}><Text>Quotation no. {data.quotationNumber}</Text><Text>Issued {new Date(data.issuedAt).toLocaleDateString("en-KE")}</Text></View><View style={styles.row}><Text>Prepared for</Text><Text>{data.customerName || "Walk-in customer"}</Text></View><View style={styles.tableHeader}><Text style={styles.product}>Product</Text><Text style={styles.cell}>Qty</Text><Text style={styles.cell}>Unit price</Text><Text style={styles.cell}>Amount</Text></View>{data.items.map((item, index) => <View key={`${item.name}-${index}`} style={styles.tableRow}><Text style={styles.product}>{item.name}</Text><Text style={styles.cell}>{item.quantity}</Text><Text style={styles.cell}>{money(item.unitPriceMinor)}</Text><Text style={styles.cell}>{money(item.lineTotalMinor)}</Text></View>)}<View style={{ marginTop: 22, marginLeft: "auto", width: 220 }}><View style={styles.row}><Text>Subtotal</Text><Text>{money(data.subtotalMinor)}</Text></View>{data.discountMinor > 0 ? <View style={styles.row}><Text>Discount</Text><Text>-{money(data.discountMinor)}</Text></View> : null}<View style={[styles.row, styles.total]}><Text>Estimated total</Text><Text>{money(data.totalMinor)}</Text></View></View>{data.notes ? <View style={styles.notes}><Text>Notes: {data.notes}</Text></View> : null}</Page></Document>;
}

export async function downloadQuotationPdf(data: QuotationData) {
  const blob = await pdf(<QuotationPdfDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `quotation-${data.quotationNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function quotationMessage(data: QuotationData, url?: string) {
  return [`Quotation ${data.quotationNumber}`, `Shop: ${data.shopName}`, `Customer: ${data.customerName || "Walk-in customer"}`, `Estimated total: ${money(data.totalMinor)}`, url ? `View quotation: ${url}` : ""].filter(Boolean).join("\n");
}
