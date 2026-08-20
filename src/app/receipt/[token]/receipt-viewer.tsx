"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadReceiptPdf, type ThermalReceiptData } from "@/components/shop/thermal-receipt";

function money(minor: number) {
  return `KES ${(minor / 100).toFixed(2)}`;
}

export function ReceiptViewer({ receipt }: { receipt: ThermalReceiptData }) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:px-0 print:py-0">
      <article className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:max-w-none print:border-0 print:shadow-none">
        <header className="border-b border-dashed border-slate-300 pb-5 text-center">
          <h1 className="text-2xl font-black text-slate-900">{receipt.businessName}</h1>
          {receipt.shopLocation ? <p className="mt-1 text-sm text-slate-500">{receipt.shopLocation}</p> : null}
          {receipt.shopContact ? <p className="text-sm text-slate-500">{receipt.shopContact}</p> : null}
          <p className="mt-4 text-xs uppercase tracking-wide text-slate-500">Receipt #{receipt.receiptNumber}</p>
          <p className="text-xs text-slate-500">{new Date(receipt.occurredAt).toLocaleString("en-KE")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-dashed border-slate-300 pt-3 text-left text-xs text-slate-500">
            <div><span className="block uppercase tracking-wide">Customer</span><strong className="text-sm text-slate-900">{receipt.customerName || "Walk-in customer"}</strong></div>
            <div><span className="block uppercase tracking-wide">Cashier</span><strong className="text-sm text-slate-900">{receipt.cashierName || "Not recorded"}</strong></div>
            {receipt.paymentReference ? <div><span className="block uppercase tracking-wide">Payment reference</span><strong className="text-sm text-slate-900">{receipt.paymentReference}</strong></div> : null}
            <div><span className="block uppercase tracking-wide">Payment</span><strong className="text-sm text-slate-900">{receipt.paymentMethod}</strong></div>
          </div>
        </header>
        <section className="py-5">
          <div className="space-y-3">
            {receipt.items.map((item, index) => <div key={`${item.name}-${index}`} className="flex justify-between gap-4 text-sm"><div><p className="font-semibold text-slate-900">{item.name}</p><p className="text-xs text-slate-500">{item.quantity} x {money(item.unitPriceMinor)}</p></div><p className="font-semibold text-slate-900">{money(item.lineTotalMinor)}</p></div>)}
          </div>
          <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(receipt.subtotalMinor)}</span></div>
            {receipt.discountMinor > 0 ? <div className="flex justify-between"><span>Discount</span><span>-{money(receipt.discountMinor)}</span></div> : null}
            {receipt.taxMinor > 0 ? <div className="flex justify-between"><span>Tax</span><span>{money(receipt.taxMinor)}</span></div> : null}
            <div className="flex justify-between text-lg font-black"><span>Total</span><span>{money(receipt.grandTotalMinor)}</span></div>
            <div className="flex justify-between text-slate-600"><span>{receipt.paymentMethod}</span><span>Paid {money(receipt.amountPaidMinor)}</span></div>
            {receipt.changeDueMinor > 0 ? <div className="flex justify-between text-slate-600"><span>Change</span><span>{money(receipt.changeDueMinor)}</span></div> : null}
            {receipt.creditAmountMinor ? <div className="flex justify-between text-slate-600"><span>Credit</span><span>{money(receipt.creditAmountMinor)}</span></div> : null}
            {typeof receipt.outstandingMinor === "number" ? <div className="flex justify-between font-semibold text-slate-600"><span>Outstanding</span><span>{money(receipt.outstandingMinor)}</span></div> : null}
          </div>
          {receipt.checkoutMode === "ETIMS" ? <div className="mt-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-900"><p className="font-bold">eTIMS / VAT information</p><p className="mt-1">Status: {receipt.etims?.status ?? "Not fiscalized"}</p>{receipt.taxableMinor !== undefined ? <p>Taxable amount: {money(receipt.taxableMinor)}</p> : null}{receipt.vatRate !== undefined ? <p>VAT rate: {receipt.vatRate}%</p> : null}{receipt.etims?.officialInvoiceNumber ? <p>Invoice: {receipt.etims.officialInvoiceNumber}</p> : null}{receipt.etims?.fiscalDocumentNumber ? <p>Fiscal document: {receipt.etims.fiscalDocumentNumber}</p> : null}{receipt.etims?.controlCode ? <p>Control code: {receipt.etims.controlCode}</p> : null}</div> : null}
          {receipt.qrCodeDataUrl ? <div className="mt-5 border-t border-dashed border-slate-300 pt-4 text-center"><img src={receipt.qrCodeDataUrl} alt={`QR code for receipt ${receipt.receiptNumber}`} className="mx-auto h-36 w-36" /><p className="mt-2 text-xs text-slate-500">Scan for receipt details</p></div> : null}
        </section>
        <footer className="border-t border-dashed border-slate-300 pt-5 text-center text-sm text-slate-500">
          <p>{receipt.thankYouMessage ?? "Thank you for shopping with us."}</p>
          {receipt.receiptFooter ? <p className="mt-1">{receipt.receiptFooter}</p> : null}
          {receipt.returnPolicy ? <p className="mt-3 text-xs">{receipt.returnPolicy}</p> : null}
        </footer>
        <div className="mt-6 flex justify-center gap-2 print:hidden">
          <Button type="button" variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" />Print / save PDF</Button>
          <Button type="button" variant="primary" onClick={() => void downloadReceiptPdf(receipt)}><Download className="h-4 w-4" />Download receipt</Button>
        </div>
      </article>
    </main>
  );
}
