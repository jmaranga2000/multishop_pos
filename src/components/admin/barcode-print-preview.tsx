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
        const imported = await import("jsbarcode");
        const JsBarcode = (imported.default ?? imported) as any;

        if (!svgRef.current) return;

        JsBarcode(svgRef.current, barcode, {
          format: /^\d{12,13}$/.test(barcode) ? "EAN13" : "CODE128",
          lineColor: "#111827",
          width: 2,
          height: 80,
          displayValue: true,
          fontSize: 14,
          margin: 8,
          background: "#ffffff",
          textMargin: 6,
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
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm print:shadow-none">
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-900">{productName}</p>
          {sku ? <p className="text-xs text-slate-500">SKU: {sku}</p> : null}
          <p className="text-xs text-slate-500">Barcode: {barcode}</p>
        </div>

        <div className="rounded-3xl bg-slate-50 p-4 print:p-0">
          <div className="mx-auto w-full max-w-[340px] print:max-w-none">
            <svg ref={svgRef} className="w-full" aria-label={`Barcode for ${barcode}`} />
          </div>
        </div>
      </div>

      {renderError ? <p className="text-sm text-red-600">{renderError}</p> : null}

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Button type="button" onClick={() => window.print()} disabled={!isReady}>
          Print barcode
        </Button>
        <p className="text-xs text-slate-500">Use your browser print dialog to print the barcode label.</p>
      </div>
    </div>
  );
}
