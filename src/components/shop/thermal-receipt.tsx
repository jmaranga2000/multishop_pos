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
  checkoutMode?: "NORMAL" | "ETIMS";
  taxableMinor?: number;
  vatRate?: number;
  etims?: {
    status?: string | null;
    officialInvoiceNumber?: string | null;
    fiscalDocumentNumber?: string | null;
    controlCode?: string | null;
    qrCodeData?: string | null;
  } | null;
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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-KE");
}

function safeText(value?: string | null) {
  return value?.trim() || "";
}

function isEtims(data: ThermalReceiptData) {
  return data.checkoutMode === "ETIMS";
}

function VatSummary({ data, compact = false }: { data: ThermalReceiptData; compact?: boolean }) {
  if (!isEtims(data)) return null;
  const label = `VAT ${Number(data.vatRate ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}%`;
  return <>
    <div className="flex items-center justify-between"><span>Taxable amount</span><span>{formatAmount(data.taxableMinor ?? data.subtotalMinor)}</span></div>
    <div className="flex items-center justify-between"><span>{label}</span><span>{formatAmount(data.taxMinor)}</span></div>
    {!compact ? <div className="mt-1 flex items-center justify-between text-sm font-black"><span>TOTAL</span><span>{formatAmount(data.grandTotalMinor)}</span></div> : null}
  </>;
}

function EtimsDetails({ data }: { data: ThermalReceiptData }) {
  if (!isEtims(data)) return null;
  return <div className="mt-3 border-t border-dashed border-slate-300 pt-2 text-[10px]">
    <p className="mb-1 font-black uppercase tracking-wide">eTIMS information</p>
    <div className="flex items-center justify-between"><span>Status</span><span className="font-bold">{safeText(data.etims?.status) || "Not fiscalized"}</span></div>
    {safeText(data.etims?.officialInvoiceNumber) ? <div className="flex items-center justify-between"><span>Invoice</span><span>{data.etims?.officialInvoiceNumber}</span></div> : null}
    {safeText(data.etims?.fiscalDocumentNumber) ? <div className="flex items-center justify-between"><span>Fiscal document</span><span>{data.etims?.fiscalDocumentNumber}</span></div> : null}
    {safeText(data.etims?.controlCode) ? <div className="flex items-center justify-between"><span>Control code</span><span>{data.etims?.controlCode}</span></div> : null}
  </div>;
}

export function ThermalReceipt({ data }: { data: ThermalReceiptData }) {
  const etims = isEtims(data);
  return <div className="mx-auto w-full max-w-[320px] border border-slate-200 bg-white p-4 font-mono text-[11px] leading-5 text-slate-800">
    <div className="text-center">
      <div className="text-sm font-black uppercase">{safeText(data.businessName) || "Receipt"}</div>
      {safeText(data.shopContact) ? <div>{data.shopContact}</div> : null}
      {safeText(data.shopLocation) ? <div>{data.shopLocation}</div> : null}
      {safeText(data.taxInfo) ? <div className="mt-1 text-[10px]">{data.taxInfo}</div> : null}
      <div className={`mt-2 font-black uppercase ${etims ? "text-blue-700" : "text-slate-700"}`}>{etims ? "eTIMS / VAT RECEIPT" : "NORMAL RECEIPT"}</div>
    </div>
    <div className="mt-3 border-t border-dashed border-slate-300 pt-2">
      <div className="flex items-center justify-between"><span>Receipt</span><span className="font-bold">{data.receiptNumber}</span></div>
      <div className="flex items-center justify-between"><span>Date</span><span>{formatDate(data.occurredAt)}</span></div>
      <div className="flex items-center justify-between"><span>Cashier</span><span>{safeText(data.cashierName) || "N/A"}</span></div>
      <div className="flex items-center justify-between"><span>Customer</span><span>{safeText(data.customerName) || "Walk-in customer"}</span></div>
      {safeText(data.paymentReference) ? <div className="flex items-center justify-between"><span>Ref</span><span>{data.paymentReference}</span></div> : null}
    </div>
    <div className="mt-3 border-t border-dashed border-slate-300 pt-2">{data.items.map((item, index) => <div key={`${item.name}-${index}`} className="mb-2"><div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><div className="font-bold">{item.name}</div><div className="text-[10px] text-slate-500">{item.quantity} × {formatAmount(item.unitPriceMinor)}{item.unitName || item.unitSymbol ? ` / ${item.unitName ?? item.unitSymbol}` : ""}</div></div><div className="text-right font-bold">{formatAmount(item.lineTotalMinor)}</div></div></div>)}</div>
    <div className="mt-3 border-t border-dashed border-slate-300 pt-2 text-[10px]">
      {etims ? <VatSummary data={data} /> : <><div className="flex items-center justify-between"><span>Subtotal</span><span>{formatAmount(data.subtotalMinor)}</span></div>{data.discountMinor > 0 ? <div className="flex items-center justify-between"><span>Discount</span><span>-{formatAmount(data.discountMinor)}</span></div> : null}<div className="mt-1 flex items-center justify-between text-sm font-black"><span>TOTAL</span><span>{formatAmount(data.grandTotalMinor)}</span></div></>}
      <div className="mt-1 flex items-center justify-between"><span>Payment</span><span>{data.paymentMethod}</span></div>
      {data.creditAmountMinor && data.creditAmountMinor > 0 ? <div className="flex items-center justify-between"><span>Credit</span><span>{formatAmount(data.creditAmountMinor)}</span></div> : null}
      <div className="flex items-center justify-between"><span>Cash received</span><span>{formatAmount(data.amountPaidMinor)}</span></div>
      <div className="flex items-center justify-between"><span>Change</span><span>{formatAmount(data.changeDueMinor)}</span></div>
      {typeof data.outstandingMinor === "number" ? <div className="mt-2 flex items-center justify-between text-sm"><span>Outstanding</span><span>{formatAmount(data.outstandingMinor)}</span></div> : null}
    </div>
    <EtimsDetails data={data} />
    {data.qrCodeDataUrl ? <div className="mt-3 border-t border-dashed border-slate-300 pt-2 text-center"><img src={data.qrCodeDataUrl} alt={`QR code for receipt ${data.receiptNumber}`} className="mx-auto h-28 w-28" /><div className="mt-1 text-[10px] text-slate-500">{etims ? "Official eTIMS QR data" : "Scan for receipt details"}</div></div> : null}
    <div className="mt-3 border-t border-dashed border-slate-300 pt-2 text-center text-[10px] text-slate-500">{safeText(data.receiptFooter) ? <div className="mb-1">{data.receiptFooter}</div> : null}<div>{safeText(data.returnPolicy) || "Returns accepted within 7 days with original receipt."}</div><div className="mt-1">{safeText(data.thankYouMessage) || "Thank you for shopping with us."}</div></div>
  </div>;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildThermalReceiptHtml(data: ThermalReceiptData) {
  const etims = isEtims(data);
  const totalRows = etims
    ? [`<div style="display:flex;justify-content:space-between"><span>Taxable amount</span><span>${formatAmount(data.taxableMinor ?? data.subtotalMinor)}</span></div>`, `<div style="display:flex;justify-content:space-between"><span>VAT ${Number(data.vatRate ?? 0)}%</span><span>${formatAmount(data.taxMinor)}</span></div>`]
    : [`<div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${formatAmount(data.subtotalMinor)}</span></div>`, data.discountMinor > 0 ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><span>-${formatAmount(data.discountMinor)}</span></div>` : ""];
  const etimsRows = etims ? [
    `<div style="margin-top:10px;border-top:1px dashed #cbd5e1;padding-top:8px;font-size:10px"><strong>eTIMS INFORMATION</strong></div>`,
    `<div style="display:flex;justify-content:space-between"><span>Status</span><span>${escapeHtml(safeText(data.etims?.status) || "Not fiscalized")}</span></div>`,
    safeText(data.etims?.officialInvoiceNumber) ? `<div>Invoice: ${escapeHtml(safeText(data.etims?.officialInvoiceNumber))}</div>` : "",
    safeText(data.etims?.fiscalDocumentNumber) ? `<div>Fiscal document: ${escapeHtml(safeText(data.etims?.fiscalDocumentNumber))}</div>` : "",
    safeText(data.etims?.controlCode) ? `<div>Control code: ${escapeHtml(safeText(data.etims?.controlCode))}</div>` : "",
  ] : [];
  const header = [
    `<div style="font-size:14px;font-weight:700;text-transform:uppercase">${escapeHtml(safeText(data.businessName) || "Receipt")}</div>`,
    safeText(data.shopContact) ? `<div>${escapeHtml(safeText(data.shopContact))}</div>` : "",
    safeText(data.shopLocation) ? `<div>${escapeHtml(safeText(data.shopLocation))}</div>` : "",
    safeText(data.taxInfo) ? `<div style="margin-top:3px;font-size:10px">${escapeHtml(safeText(data.taxInfo))}</div>` : "",
    `<div style="margin-top:6px;font-weight:700;color:${etims ? "#1d4ed8" : "#334155"}">${etims ? "eTIMS / VAT RECEIPT" : "NORMAL RECEIPT"}</div>`,
  ].filter(Boolean).join("");
  return [
    `<div style="max-width:320px;margin:0 auto;border:1px solid #cbd5e1;padding:16px;font-family:ui-monospace,Consolas,monospace;background:#fff;color:#111;line-height:1.45">`,
    `<div style="text-align:center">${header}</div>`,
    `<div style="margin-top:10px;border-top:1px dashed #cbd5e1;padding-top:8px"><div style="display:flex;justify-content:space-between"><span>Receipt</span><strong>${escapeHtml(data.receiptNumber)}</strong></div><div style="display:flex;justify-content:space-between"><span>Date</span><span>${escapeHtml(formatDate(data.occurredAt))}</span></div><div style="display:flex;justify-content:space-between"><span>Cashier</span><span>${escapeHtml(safeText(data.cashierName) || "N/A")}</span></div><div style="display:flex;justify-content:space-between"><span>Customer</span><span>${escapeHtml(safeText(data.customerName) || "Walk-in customer")}</span></div>${safeText(data.paymentReference) ? `<div style="display:flex;justify-content:space-between"><span>Ref</span><span>${escapeHtml(safeText(data.paymentReference))}</span></div>` : ""}</div>`,
    `<div style="margin-top:10px;border-top:1px dashed #cbd5e1;padding-top:8px">${data.items.map((item) => `<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px"><span>${escapeHtml(item.name)}<br/><small>${escapeHtml(`${item.quantity} × ${formatAmount(item.unitPriceMinor)}`)}</small></span><strong>${formatAmount(item.lineTotalMinor)}</strong></div>`).join("")}</div>`,
    `<div style="margin-top:10px;border-top:1px dashed #cbd5e1;padding-top:8px;font-size:10px">${totalRows.join("")}<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:12px;font-weight:700"><span>TOTAL</span><span>${formatAmount(data.grandTotalMinor)}</span></div><div style="display:flex;justify-content:space-between"><span>Payment</span><span>${escapeHtml(data.paymentMethod)}</span></div></div>`,
    ...etimsRows,
    data.qrCodeDataUrl ? `<div style="margin-top:10px;text-align:center"><img src="${data.qrCodeDataUrl}" style="width:110px;height:110px"/></div>` : "",
    `</div>`,
  ].filter(Boolean).join("");
}

const styles = StyleSheet.create({ page: { padding: 24, fontSize: 9, fontFamily: "Courier" }, center: { textAlign: "center" }, row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }, divider: { borderTopWidth: 1, borderTopColor: "#cbd5e1", borderTopStyle: "dashed", marginTop: 10, paddingTop: 8 }, bold: { fontFamily: "Courier-Bold" }, qr: { width: 100, height: 100, alignSelf: "center", marginTop: 10 } });

export function ReceiptPdfDocument({ data }: { data: ThermalReceiptData }) {
  const etims = isEtims(data);
  return (
    <Document>
      <Page size={{ width: 260, height: "auto" }} style={styles.page}>
        <View style={styles.center}>
          <Text style={styles.bold}>{safeText(data.businessName) || "Receipt"}</Text>
          {safeText(data.shopContact) ? <Text>{data.shopContact}</Text> : null}
          {safeText(data.shopLocation) ? <Text>{data.shopLocation}</Text> : null}
          {safeText(data.taxInfo) ? <Text>{data.taxInfo}</Text> : null}
          <Text>{etims ? "eTIMS / VAT RECEIPT" : "NORMAL RECEIPT"}</Text>
        </View>
        <View style={styles.divider}>
          <View style={styles.row}><Text>Receipt</Text><Text>{data.receiptNumber}</Text></View>
          <View style={styles.row}><Text>Date</Text><Text>{formatDate(data.occurredAt)}</Text></View>
          <View style={styles.row}><Text>Cashier</Text><Text>{safeText(data.cashierName) || "N/A"}</Text></View>
          <View style={styles.row}><Text>Customer</Text><Text>{safeText(data.customerName) || "Walk-in customer"}</Text></View>
          {safeText(data.paymentReference) ? <View style={styles.row}><Text>Ref</Text><Text>{data.paymentReference}</Text></View> : null}
        </View>
        <View style={styles.divider}>
          {data.items.map((item, index) => <View key={`${item.name}-${index}`} style={styles.row}><Text>{item.name} × {item.quantity}</Text><Text>{formatAmount(item.lineTotalMinor)}</Text></View>)}
        </View>
        <View style={styles.divider}>
          {etims ? <><View style={styles.row}><Text>Taxable amount</Text><Text>{formatAmount(data.taxableMinor ?? data.subtotalMinor)}</Text></View><View style={styles.row}><Text>VAT {data.vatRate ?? 0}%</Text><Text>{formatAmount(data.taxMinor)}</Text></View></> : <View style={styles.row}><Text>Subtotal</Text><Text>{formatAmount(data.subtotalMinor)}</Text></View>}
          <View style={styles.row}><Text style={styles.bold}>TOTAL</Text><Text style={styles.bold}>{formatAmount(data.grandTotalMinor)}</Text></View>
          <View style={styles.row}><Text>Payment</Text><Text>{data.paymentMethod}</Text></View>
        </View>
        {etims ? <View style={styles.divider}><Text style={styles.bold}>eTIMS INFORMATION</Text><Text>Status: {safeText(data.etims?.status) || "Not fiscalized"}</Text>{safeText(data.etims?.officialInvoiceNumber) ? <Text>Invoice: {data.etims?.officialInvoiceNumber}</Text> : null}{safeText(data.etims?.fiscalDocumentNumber) ? <Text>Fiscal document: {data.etims?.fiscalDocumentNumber}</Text> : null}{safeText(data.etims?.controlCode) ? <Text>Control code: {data.etims?.controlCode}</Text> : null}</View> : null}
        {data.qrCodeDataUrl ? <Image src={data.qrCodeDataUrl} style={styles.qr} /> : null}
      </Page>
    </Document>
  );
}

export async function downloadReceiptPdf(data: ThermalReceiptData) {
  const blob = await pdf(<ReceiptPdfDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `receipt-${data.receiptNumber}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}