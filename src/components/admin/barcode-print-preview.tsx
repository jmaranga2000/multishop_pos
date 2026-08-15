"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type BarcodePrintPreviewProps = {
  barcode: string;
  productName: string;
  sku?: string;
};

export function BarcodePrintPreview({ barcode, productName, sku }: BarcodePrintPreviewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRenderError(null);
    setIsReady(false);

    async function renderBarcode() {
      try {
        const trimmedBarcode = barcode?.trim();
        if (!trimmedBarcode) {
          if (!cancelled) {
            setRenderError("Barcode is missing.");
          }
          return;
        }

        const imported = await import("jsbarcode");
        const JsBarcode = (imported.default ?? imported) as any;

        if (!svgRef.current) return;

        JsBarcode(svgRef.current, trimmedBarcode, {
          format: /^\d{12,13}$/.test(trimmedBarcode) ? "EAN13" : "CODE128",
          lineColor: "#111827",
          width: 1.8,
          height: 72,
          displayValue: true,
          fontSize: 12,
          margin: 10,
          background: "#ffffff",
          textMargin: 6,
          flat: false,
        });

        if (!cancelled) {
          setIsReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setRenderError(error instanceof Error ? error.message : "Unable to generate barcode.");
        }
      }
    }

    renderBarcode();
    return () => {
      cancelled = true;
    };
  }, [barcode]);

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 10mm;
          }

          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          body * {
            visibility: hidden !important;
          }

          .barcode-print-area,
          .barcode-print-area * {
            visibility: visible !important;
          }

          .barcode-print-area {
            position: static !important;
            display: block !important;
            width: auto !important;
            max-width: 340px !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }

          .barcode-print-area .barcode-card {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }

          .barcode-print-area svg {
            display: block !important;
            width: 100% !important;
            height: auto !important;
            max-width: 100% !important;
            object-fit: contain !important;
            transform: none !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="space-y-4">
        <div className="barcode-print-area overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm print:shadow-none">
          <div className="barcode-card">
            <div className="mb-4">
              <p className="text-sm font-semibold text-slate-900">{productName}</p>
              {sku ? <p className="text-xs text-slate-500">SKU: {sku}</p> : null}
              <p className="text-xs text-slate-500">Barcode: {barcode}</p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-4 print:p-0">
              <div className="mx-auto w-full max-w-[340px]">
                <svg ref={svgRef} className="block h-auto w-full max-w-full" aria-label={`Barcode for ${barcode}`} />
              </div>
            </div>
          </div>
        </div>

        {renderError ? <p className="text-sm text-red-600">{renderError}</p> : null}

        <div className="no-print flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => window.print()} disabled={!isReady}>
            Print barcode
          </Button>
          <p className="text-xs text-slate-500">Use your browser print dialog to print the barcode label.</p>
        </div>
      </div>
    </>
  );
}
