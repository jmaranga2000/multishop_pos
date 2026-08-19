"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ReportPdfExportButton({ url, fileName, label = "PDF", variant = "primary" }: { url: string; fileName: string; label?: string; variant?: "primary" | "secondary" | "ghost" }) {
  const [loading, setLoading] = useState(false);

  async function exportPdf() {
    if (loading) return;
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      toast.error("Allow pop-ups to preview the PDF.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(url, { credentials: "same-origin" });
      if (!response.ok) throw new Error("Unable to generate the PDF.");
      const blob = await response.blob();
      const previewUrl = URL.createObjectURL(blob);
      previewWindow.location.href = previewUrl;

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
        URL.revokeObjectURL(previewUrl);
      }, 60_000);
    } catch (error) {
      previewWindow.close();
      toast.error(error instanceof Error ? error.message : "Unable to generate the PDF.");
    } finally {
      setLoading(false);
    }
  }

  return <Button type="button" variant={variant} onClick={() => void exportPdf()} isLoading={loading} disabled={loading} loadingText="Preparing PDF..."><Download className="h-4 w-4" />{label}</Button>;
}
