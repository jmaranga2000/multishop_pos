import { Document, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

export type ThermalReceiptData = {
  businessName: string;
  shopLocation?: string | null;
  shopContact?: string | null;
  taxInfo?: string | null;
  receiptNumber: string;
  occurredAt: string;
  cashierName: string;
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
  taxMinor: number;
  grandTotalMinor: number;
  paymentMethod: string;
  amountPaidMinor: number;
  creditAmountMinor?: number;
  outstandingMinor?: number;
  changeDueMinor: number;
  paymentReference?: string | null;
  receiptFooter?: string | null;
  returnPolicy?: string | null;
  thankYouMessage?: string | null;
  qrCodeDataUrl?: string | null;
};

function formatAmount(value: number) {
  return `KES ${Number(value / 100).toFixed(2)}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function safeText(value?: string | null) {
  return value?.trim() || "";
}

export function ThermalReceipt({ data }: { data: ThermalReceiptData }) {
  return (
    <div className="mx-auto w-full max-w-[320px] border border-slate-200 bg-white p-4 font-mono text-[11px] leading-5 text-slate-800">
      <div className="text-center">
        <div className="text-sm font-black uppercase">{safeText(data.businessName) || "Receipt"}</div>
        {safeText(data.shopLocation) ? <div>{data.shopLocation}</div> : null}
        {safeText(data.shopContact) ? <div>{data.shopContact}</div> : null}
        {safeText(data.taxInfo) ? <div className="mt-1 text-[10px]">{data.taxInfo}</div> : null}
      </div>
      <div className="mt-3 border-t border-dashed border-slate-300 pt-2">
        <div className="flex items-center justify-between"><span>Receipt</span><span className="font-bold">{data.receiptNumber}</span></div>
        <div className="flex items-center justify-between"><span>Date</span><span>{formatDate(data.occurredAt)}</span></div>
        <div className="flex items-center justify-between"><span>Cashier</span><span>{safeText(data.cashierName) || "N/A"}</span></div>
        <div className="flex items-center justify-between"><span>Customer</span><span>{safeText(data.customerName) || "Walk-in customer"}</span></div>
        {safeText(data.paymentReference) ? <div className="flex items-center justify-between"><span>Ref</span><span>{data.paymentReference}</span></div> : null}
      </div>
      <div className="mt-3 border-t border-dashed border-slate-300 pt-2">
        {data.items.map((item, index) => (
          <div key={`${item.name}-${index}`} className="mb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-bold">{item.name}</div>
                <div className="text-[10px] text-slate-500">{item.quantity} × {formatAmount(item.unitPriceMinor)}{item.unitName || item.unitSymbol ? ` / ${item.unitName ?? item.unitSymbol}` : ""}</div>
              </div>
              <div className="text-right font-bold">{formatAmount(item.lineTotalMinor)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-dashed border-slate-300 pt-2 text-[10px]">
        <p className="mb-1 text-slate-500">All unit selling prices are VAT inclusive.</p>
        <div className="flex items-center justify-between"><span>Items total (VAT incl.)</span><span>{formatAmount(data.subtotalMinor)}</span></div>
        {data.discountMinor > 0 ? <div className="flex items-center justify-between"><span>Discount</span><span>-{formatAmount(data.discountMinor)}</span></div> : null}
        {data.taxMinor > 0 ? <div className="flex items-center justify-between"><span>VAT included in total</span><span>{formatAmount(data.taxMinor)}</span></div> : null}
        <div className="mt-1 flex items-center justify-between text-sm font-black"><span>Total (VAT inclusive)</span><span>{formatAmount(data.grandTotalMinor)}</span></div>
        <div className="mt-1 flex items-center justify-between"><span>Payment</span><span>{data.paymentMethod}</span></div>
        {data.creditAmountMinor && data.creditAmountMinor > 0 ? <div className="flex items-center justify-between"><span>Credit</span><span>{formatAmount(data.creditAmountMinor)}</span></div> : null}
        <div className="flex items-center justify-between"><span>Cash received</span><span>{formatAmount(data.amountPaidMinor)}</span></div>
        <div className="flex items-center justify-between"><span>Change</span><span>{formatAmount(data.changeDueMinor)}</span></div>
        {typeof data.outstandingMinor === "number" ? <div className="mt-2 flex items-center justify-between text-sm"><span>Outstanding</span><span>{formatAmount(data.outstandingMinor)}</span></div> : null}
      </div>
      {data.qrCodeDataUrl ? <div className="mt-3 border-t border-dashed border-slate-300 pt-2 text-center"><img src={data.qrCodeDataUrl} alt={`QR code for receipt ${data.receiptNumber}`} className="mx-auto h-28 w-28" /><div className="mt-1 text-[10px] text-slate-500">Scan for receipt details</div></div> : null}
      <div className="mt-3 border-t border-dashed border-slate-300 pt-2 text-center text-[10px] text-slate-500">
        {safeText(data.receiptFooter) ? <div className="mb-1">{data.receiptFooter}</div> : null}
        <div>{safeText(data.returnPolicy) || "Returns accepted within 7 days with original receipt."}</div>
        <div className="mt-1">{safeText(data.thankYouMessage) || "Thank you for shopping with us."}</div>
      </div>
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

export function buildThermalReceiptHtml(data: ThermalReceiptData) {
  const lines = [
    `<div style="max-width:320px;margin:0 auto;border:1px solid #cbd5e1;padding:16px;font-family:ui-monospace,Consolas,monospace;background:#fff;color:#111;line-height:1.45;">`,
    `<div style="text-align:center;">`,
    `<div style="font-size:14px;font-weight:700;text-transform:uppercase;">${escapeHtml(safeText(data.businessName) || "Receipt")}</div>`,
    safeText(data.shopLocation) ? `<div>${escapeHtml(safeText(data.shopLocation))}</div>` : "",
    safeText(data.shopContact) ? `<div>${escapeHtml(safeText(data.shopContact))}</div>` : "",
    safeText(data.taxInfo) ? `<div style="margin-top:6px;font-size:10px;">${escapeHtml(safeText(data.taxInfo))}</div>` : "",
    `</div>`,
    `<div style="margin-top:10px;border-top:1px dashed #cbd5e1;padding-top:8px;">`,
    `<div style="display:flex;justify-content:space-between;gap:8px;"><span>Receipt</span><span style="font-weight:700;">${escapeHtml(data.receiptNumber)}</span></div>`,
    `<div style="display:flex;justify-content:space-between;gap:8px;"><span>Date</span><span>${escapeHtml(formatDate(data.occurredAt))}</span></div>`,
    `<div style="display:flex;justify-content:space-between;gap:8px;"><span>Cashier</span><span>${escapeHtml(safeText(data.cashierName) || "N/A")}</span></div>`,
    `<div style="display:flex;justify-content:space-between;gap:8px;"><span>Customer</span><span>${escapeHtml(safeText(data.customerName) || "Walk-in customer")}</span></div>`,
    safeText(data.paymentReference) ? `<div style="display:flex;justify-content:space-between;gap:8px;"><span>Ref</span><span>${escapeHtml(safeText(data.paymentReference))}</span></div>` : "",
    `</div>`,
    `<div style="margin-top:10px;border-top:1px dashed #cbd5e1;padding-top:8px;">`,
    ...data.items.map((item) => `<div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;gap:8px;"><div style="flex:1;min-width:0;"><div style="font-weight:700;">${escapeHtml(item.name)}</div><div style="font-size:10px;color:#64748b;">${escapeHtml(`${item.quantity} × ${formatAmount(item.unitPriceMinor)}${item.unitName || item.unitSymbol ? ` / ${item.unitName ?? item.unitSymbol}` : ""}`)}</div></div><div style="font-weight:700;white-space:nowrap;">${escapeHtml(formatAmount(item.lineTotalMinor))}</div></div></div>`),
    `</div>`,
    `<div style="margin-top:10px;border-top:1px dashed #cbd5e1;padding-top:8px;font-size:10px;">`,
    `<div style="display:flex;justify-content:space-between;gap:8px;"><span>Items total (VAT incl.)</span><span>${escapeHtml(formatAmount(data.subtotalMinor))}</span></div>`,
    data.discountMinor > 0 ? `<div style="display:flex;justify-content:space-between;gap:8px;"><span>Discount</span><span>-${escapeHtml(formatAmount(data.discountMinor))}</span></div>` : "",
    data.taxMinor > 0 ? `<div style="display:flex;justify-content:space-between;gap:8px;"><span>VAT included in total</span><span>${escapeHtml(formatAmount(data.taxMinor))}</span></div>` : "",
    `<div style="display:flex;justify-content:space-between;gap:8px;margin-top:6px;font-size:12px;font-weight:700;"><span>Total (VAT inclusive)</span><span>${escapeHtml(formatAmount(data.grandTotalMinor))}</span></div>`,
    `<div style="display:flex;justify-content:space-between;gap:8px;"><span>Payment</span><span>${escapeHtml(data.paymentMethod)}</span></div>`,
    ${data.creditAmountMinor && data.creditAmountMinor > 0 ? `<div style="display:flex;justify-content:space-between;gap:8px;"><span>Credit</span><span>${escapeHtml(formatAmount(data.creditAmountMinor))}</span></div>` : ""}
    `<div style="display:flex;justify-content:space-between;gap:8px;"><span>Cash received</span><span>${escapeHtml(formatAmount(data.amountPaidMinor))}</span></div>`,
    `<div style="display:flex;justify-content:space-between;gap:8px;"><span>Change</span><span>${escapeHtml(formatAmount(data.changeDueMinor))}</span></div>`,
    ${typeof data.outstandingMinor === 'number' ? `<div style="display:flex;justify-content:space-between;gap:8px;margin-top:6px;font-size:12px;font-weight:700;"><span>Outstanding</span><span>${escapeHtml(formatAmount(data.outstandingMinor))}</span></div>` : ""}
    `</div>`,
    data.qrCodeDataUrl ? `<div style="margin-top:10px;border-top:1px dashed #cbd5e1;padding-top:8px;text-align:center;"><img src="${escapeHtml(data.qrCodeDataUrl)}" alt="Receipt QR code" style="width:112px;height:112px;" /><div style="margin-top:4px;font-size:10px;color:#64748b;">Scan for receipt details</div></div>` : "",
    `<div style="margin-top:10px;border-top:1px dashed #cbd5e1;padding-top:8px;text-align:center;font-size:10px;color:#64748b;">`,
    safeText(data.receiptFooter) ? `<div style="margin-bottom:4px;">${escapeHtml(safeText(data.receiptFooter))}</div>` : "",
    `<div>${escapeHtml(safeText(data.returnPolicy) || "Returns accepted within 7 days with original receipt.")}</div>`,
    `<div style="margin-top:4px;">${escapeHtml(safeText(data.thankYouMessage) || "Thank you for shopping with us.")}</div>`,
    `</div>`,
    `</div>`,
  ];
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(data.receiptNumber)}</title><style>body{font-family:ui-monospace,Consolas,monospace;background:#fff;margin:0;padding:16px;color:#111}*{box-sizing:border-box}@media print{body{padding:0}}</style></head><body>${lines.join("")}</body></html>`;
}

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", padding: 24, backgroundColor: "#fff" },
  container: { borderWidth: 1, borderColor: "#cbd5e1", padding: 12 },
  heading: { fontSize: 13, fontWeight: "bold", textAlign: "center" },
  subheading: { fontSize: 9, textAlign: "center", color: "#475569" },
  section: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0", borderStyle: "dashed", paddingTop: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  label: { fontSize: 9, color: "#334155" },
  value: { fontSize: 9, fontWeight: "bold" },
  item: { marginBottom: 4 },
  itemName: { fontSize: 9, fontWeight: "bold" },
  itemMeta: { fontSize: 8, color: "#64748b" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  qrCode: { width: 72, height: 72, alignSelf: "center", marginTop: 10 },
  footer: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0", borderStyle: "dashed", paddingTop: 6, textAlign: "center", fontSize: 8, color: "#64748b" },
});

function ReceiptPdfDocument({ data }: { data: ThermalReceiptData }) {
  return (
    <Document>
      <Page size="A6" style={styles.page}>
        <View style={styles.container}>
          <Text style={styles.heading}>{safeText(data.businessName) || "Receipt"}</Text>
          {safeText(data.shopLocation) ? <Text style={styles.subheading}>{data.shopLocation}</Text> : null}
          {safeText(data.shopContact) ? <Text style={styles.subheading}>{data.shopContact}</Text> : null}
          {safeText(data.taxInfo) ? <Text style={styles.subheading}>{data.taxInfo}</Text> : null}
          <View style={styles.section}>
            <View style={styles.row}><Text style={styles.label}>Receipt</Text><Text style={styles.value}>{data.receiptNumber}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Date</Text><Text style={styles.value}>{formatDate(data.occurredAt)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Cashier</Text><Text style={styles.value}>{safeText(data.cashierName) || "N/A"}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Customer</Text><Text style={styles.value}>{safeText(data.customerName) || "Walk-in customer"}</Text></View>
          </View>
          <View style={styles.section}>
            {data.items.map((item, index) => (
              <View key={`${item.name}-${index}`} style={styles.item}>
                <View style={styles.row}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.value}>{formatAmount(item.lineTotalMinor)}</Text></View>
                <Text style={styles.itemMeta}>{item.quantity} × {formatAmount(item.unitPriceMinor)}{item.unitName || item.unitSymbol ? ` / ${item.unitName ?? item.unitSymbol}` : ""}</Text>
              </View>
            ))}
          </View>
          <View style={styles.section}>
            <View style={styles.totalRow}><Text style={styles.label}>Items total (VAT incl.)</Text><Text style={styles.value}>{formatAmount(data.subtotalMinor)}</Text></View>
            {data.discountMinor > 0 ? <View style={styles.totalRow}><Text style={styles.label}>Discount</Text><Text style={styles.value}>-{formatAmount(data.discountMinor)}</Text></View> : null}
            {data.taxMinor > 0 ? <View style={styles.totalRow}><Text style={styles.label}>VAT included in total</Text><Text style={styles.value}>{formatAmount(data.taxMinor)}</Text></View> : null}
            <View style={styles.totalRow}><Text style={styles.label}>Total (VAT inclusive)</Text><Text style={styles.value}>{formatAmount(data.grandTotalMinor)}</Text></View>
            <View style={styles.totalRow}><Text style={styles.label}>Payment</Text><Text style={styles.value}>{data.paymentMethod}</Text></View>
            {data.creditAmountMinor && data.creditAmountMinor > 0 ? <View style={styles.totalRow}><Text style={styles.label}>Credit</Text><Text style={styles.value}>{formatAmount(data.creditAmountMinor)}</Text></View> : null}
            <View style={styles.totalRow}><Text style={styles.label}>Cash received</Text><Text style={styles.value}>{formatAmount(data.amountPaidMinor)}</Text></View>
            <View style={styles.totalRow}><Text style={styles.label}>Change</Text><Text style={styles.value}>{formatAmount(data.changeDueMinor)}</Text></View>
            {typeof data.outstandingMinor === "number" ? <View style={styles.totalRow}><Text style={styles.label}>Outstanding</Text><Text style={styles.value}>{formatAmount(data.outstandingMinor)}</Text></View> : null}
          </View>
          {data.qrCodeDataUrl ? <View><Image src={data.qrCodeDataUrl} style={styles.qrCode} /><Text style={styles.subheading}>Scan for receipt details</Text></View> : null}
          <View style={styles.footer}>
            {safeText(data.receiptFooter) ? <Text>{data.receiptFooter}</Text> : null}
            <Text>{safeText(data.returnPolicy) || "Returns accepted within 7 days with original receipt."}</Text>
            <Text>{safeText(data.thankYouMessage) || "Thank you for shopping with us."}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadReceiptPdf(data: ThermalReceiptData) {
  const blob = await pdf(<ReceiptPdfDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${(data.receiptNumber || "receipt").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
