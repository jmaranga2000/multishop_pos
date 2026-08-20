import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

export type QuotationData = {
  businessName?: string | null;
  shopName: string;
  physicalAddress?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  quotationNumber: string;
  issuedAt: string;
  validUntil: string;
  cashierName: string;
  counterName: string;
  customerName: string;
  items: Array<{ productId?: string; sku?: string; name: string; quantity: number; unitName?: string | null; unitSymbol?: string | null; unitPriceMinor: number; lineTotalMinor: number; vatRate: number; vatMinor: number }>;
  subtotalMinor: number;
  discountMinor: number;
  vatMinor: number;
  totalMinor: number;
  notes?: string | null;
  paymentInfo?: { mpesaTill?: string | null; mpesaPaybill?: string | null; bankName?: string | null; bankAccountNumber?: string | null; bankAccountName?: string | null };
  shareUrl?: string | null;
};

function money(minor: number) { return `KES ${(minor / 100).toFixed(2)}`; }
function date(value: string) { return new Date(value).toLocaleDateString("en-KE"); }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character)); }
function quotationTerms(data: QuotationData) { return [`This quotation is valid until ${date(data.validUntil)}.`, "Prices are subject to availability and may change after the quotation expiry date.", "This quotation does not constitute a completed sale.", "Conversion reference: present quotation number at checkout to convert this quotation to a sale."]; }

export function buildQuotationHtml(data: QuotationData) {
  const rows = data.items.map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.sku ?? "")}</small></td><td>${item.quantity}</td><td>${money(item.unitPriceMinor)}</td><td>${money(item.lineTotalMinor)}</td></tr>`).join("");
  const payment = data.paymentInfo ?? {};
  const paymentHtml = [payment.mpesaTill && `M-Pesa Till: ${escapeHtml(payment.mpesaTill)}`, payment.mpesaPaybill && `M-Pesa Paybill: ${escapeHtml(payment.mpesaPaybill)}`, payment.bankName && `Bank: ${escapeHtml(payment.bankName)}`, payment.bankAccountNumber && `Account: ${escapeHtml(payment.bankAccountNumber)}`, payment.bankAccountName && `Account name: ${escapeHtml(payment.bankAccountName)}`].filter(Boolean).join("<br>");
  const termHtml = quotationTerms(data).map((term) => `<li>${escapeHtml(term)}</li>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Quotation ${escapeHtml(data.quotationNumber)}</title><style>body{margin:0;background:#f1f5f9;color:#0f172a;font:10px Arial,sans-serif}.sheet{max-width:820px;margin:16px auto;background:#fff;padding:24px;box-shadow:0 8px 24px #0f172a1f}.topline{height:5px;background:#2563eb;margin:-24px -24px 18px}.brand{font-size:20px;font-weight:800}.muted{color:#64748b;font-size:10px;line-height:1.35}.title{margin-top:16px;font-size:24px;font-weight:900;color:#1d4ed8}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px;padding:9px 0;border-block:1px solid #e2e8f0}.meta span{font-size:9px;color:#64748b}.meta strong{display:block;margin-top:2px;color:#0f172a;font-size:10px}.customer{margin-top:12px;font-size:11px}.customer strong{display:block;font-size:13px;margin-top:3px}table{width:100%;border-collapse:collapse;margin-top:16px}th{text-align:left;background:#eff6ff;color:#1e3a8a;font-size:9px;text-transform:uppercase;padding:7px}td{border-bottom:1px solid #e2e8f0;padding:7px 8px;font-size:10px}td:nth-child(n+2),th:nth-child(n+2){text-align:right}td small{display:block;color:#64748b;font-size:8px;margin-top:2px}.totals{margin:14px 0 0 auto;max-width:260px}.line,.grand{display:flex;justify-content:space-between;margin-top:4px}.grand{border-top:2px solid #1d4ed8;margin-top:6px;padding-top:7px;font-size:15px;font-weight:800}.columns{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.box{padding:9px;background:#f8fafc;color:#475569;font-size:9px;line-height:1.4}.box strong{display:block;color:#0f172a;margin-bottom:3px}.box ul{margin:0;padding-left:16px}.footer{margin-top:14px;padding-top:8px;border-top:1px solid #e2e8f0;color:#64748b;font-size:8px}@media print{body{background:#fff}.sheet{margin:0;max-width:none;box-shadow:none}}</style></head><body><main class="sheet"><div class="topline"></div><div class="brand">${escapeHtml(data.businessName ?? data.shopName)}</div><div class="muted"><strong>${escapeHtml(data.shopName)}</strong><br>${escapeHtml(data.physicalAddress ?? "")}<br>${escapeHtml(data.phoneNumber ?? "")} ${data.email ? `• ${escapeHtml(data.email)}` : ""}</div><div class="title">QUOTATION</div><div class="meta"><span>Quotation number<strong>${escapeHtml(data.quotationNumber)}</strong></span><span>Issue date<strong>${date(data.issuedAt)}</strong></span><span>Valid until<strong>${date(data.validUntil)}</strong></span><span>Cashier / counter<strong>${escapeHtml(data.cashierName)} / ${escapeHtml(data.counterName)}</strong></span></div><div class="customer">Prepared for<strong>${escapeHtml(data.customerName || "Walk-in customer")}</strong></div><table><thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div class="line"><span>Subtotal</span><strong>${money(data.subtotalMinor)}</strong></div><div class="line"><span>Discount</span><strong>-${money(data.discountMinor)}</strong></div><div class="line"><span>VAT</span><strong>${money(data.vatMinor)}</strong></div><div class="grand"><span>Grand total</span><span>${money(data.totalMinor)}</span></div></div><div class="columns"><div class="box"><strong>Payment information</strong>${paymentHtml || "No payment details configured."}</div><div class="box"><strong>Terms and conditions</strong><ul>${termHtml}</ul></div></div>${data.notes ? `<div class="box" style="margin-top:10px"><strong>Notes</strong>${escapeHtml(data.notes)}</div>` : ""}<div class="footer">Conversion reference: ${escapeHtml(data.quotationNumber)}. Keep this quotation number for conversion to sale.</div></main></body></html>`;
}

const styles = StyleSheet.create({
  page: { padding: 24, fontFamily: "Helvetica", fontSize: 8, color: "#0f172a" },
  line: { height: 5, backgroundColor: "#2563eb", marginBottom: 16 },
  brand: { fontSize: 17, fontWeight: 700 },
  muted: { color: "#64748b", marginTop: 3, lineHeight: 1.25 },
  title: { color: "#1d4ed8", fontSize: 21, fontWeight: 700, marginTop: 14 },
  meta: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#e2e8f0", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 8, marginTop: 10 },
  metaItem: { width: "24%", color: "#64748b", fontSize: 8 },
  strong: { color: "#0f172a", fontWeight: 700, marginTop: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
  customer: { marginTop: 12 },
  tableHeader: { flexDirection: "row", backgroundColor: "#eff6ff", marginTop: 14, padding: 6 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", padding: 6 },
  product: { flex: 2 },
  cell: { flex: 1, textAlign: "right" },
  total: { borderTopWidth: 2, borderTopColor: "#1d4ed8", paddingTop: 7, marginTop: 6, fontSize: 11, fontWeight: 700 },
  columns: { flexDirection: "row", gap: 8, marginTop: 14 },
  box: { flex: 1, backgroundColor: "#f8fafc", padding: 8, color: "#475569", lineHeight: 1.3, fontSize: 8 },
  footer: { marginTop: 14, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", color: "#64748b", fontSize: 7 },
});

export function QuotationPdfDocument({ data }: { data: QuotationData }) {
  const payment = data.paymentInfo ?? {};
  return <Document><Page size="A4" style={styles.page}><View style={styles.line} /><Text style={styles.brand}>{data.businessName ?? data.shopName}</Text><Text style={styles.muted}>{data.shopName}{`\n${data.physicalAddress ?? ""}`}{`\n${data.phoneNumber ?? ""} ${data.email ? `• ${data.email}` : ""}`}</Text><Text style={styles.title}>QUOTATION</Text><View style={styles.meta}><Text style={styles.metaItem}>Quotation number<Text style={styles.strong}>{data.quotationNumber}</Text></Text><Text style={styles.metaItem}>Issue date<Text style={styles.strong}>{date(data.issuedAt)}</Text></Text><Text style={styles.metaItem}>Valid until<Text style={styles.strong}>{date(data.validUntil)}</Text></Text><Text style={styles.metaItem}>Cashier / counter<Text style={styles.strong}>{data.cashierName} / {data.counterName}</Text></Text></View><View style={styles.customer}><Text>Prepared for</Text><Text style={styles.strong}>{data.customerName || "Walk-in customer"}</Text></View><View style={styles.tableHeader}><Text style={styles.product}>Product</Text><Text style={styles.cell}>Qty</Text><Text style={styles.cell}>Unit price</Text><Text style={styles.cell}>Amount</Text></View>{data.items.map((item, index) => <View key={`${item.productId ?? item.name}-${index}`} style={styles.tableRow}><Text style={styles.product}>{item.name}{item.sku ? `\n${item.sku}` : ""}</Text><Text style={styles.cell}>{item.quantity}</Text><Text style={styles.cell}>{money(item.unitPriceMinor)}</Text><Text style={styles.cell}>{money(item.lineTotalMinor)}</Text></View>)}<View style={{ marginTop: 12, marginLeft: "auto", width: 220 }}><View style={styles.row}><Text>Subtotal</Text><Text>{money(data.subtotalMinor)}</Text></View><View style={styles.row}><Text>Discount</Text><Text>-{money(data.discountMinor)}</Text></View><View style={styles.row}><Text>VAT</Text><Text>{money(data.vatMinor)}</Text></View><View style={[styles.row, styles.total]}><Text>Grand total</Text><Text>{money(data.totalMinor)}</Text></View></View><View style={styles.columns}><View style={styles.box}><Text style={styles.strong}>Payment information</Text>{payment.mpesaTill ? <Text>M-Pesa Till: {payment.mpesaTill}</Text> : null}{payment.mpesaPaybill ? <Text>M-Pesa Paybill: {payment.mpesaPaybill}</Text> : null}{payment.bankName ? <Text>Bank: {payment.bankName}</Text> : null}{payment.bankAccountNumber ? <Text>Account: {payment.bankAccountNumber}</Text> : null}{payment.bankAccountName ? <Text>Account name: {payment.bankAccountName}</Text> : null}</View><View style={styles.box}><Text style={styles.strong}>Terms and conditions</Text>{quotationTerms(data).map((item, index) => <Text key={index}>• {item}</Text>)}</View></View>{data.notes ? <View style={[styles.box, { marginTop: 10 }]}><Text style={styles.strong}>Notes</Text><Text>{data.notes}</Text></View> : null}<Text style={styles.footer}>Conversion reference: {data.quotationNumber}. Keep this quotation number for conversion to sale.</Text></Page></Document>;
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
  return [`Quotation ${data.quotationNumber}`, `Shop: ${data.shopName}`, `Customer: ${data.customerName || "Walk-in customer"}`, `Valid until: ${date(data.validUntil)}`, `Grand total: ${money(data.totalMinor)}`, url ? `Download quotation PDF: ${url}` : ""].filter(Boolean).join("\n");
}
