"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Trash2 } from "lucide-react";

type ProductImageUploaderProps = {
  value: string;
  onChange: (value: string) => void;
};

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

export function ProductImageUploader({ value, onChange }: ProductImageUploaderProps) {
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const canUpload = Boolean(cloudName);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    try {
      if (!cloudName) {
        throw new Error("Cloudinary is not configured.");
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/cloudinary/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Upload failed. Check your Cloudinary settings and try again.");
      }

      const data = await response.json();
      if (!data?.secure_url) {
        throw new Error("Upload response did not include an image URL.");
      }

      onChange(data.secure_url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload image.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">Product image</label>
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <Input
          name="imageUrl"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Image URL or upload file"
        />
        <Button
          type="button"
          variant="secondary"
          className="min-w-[120px]"
          disabled={uploading || !canUpload}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
          {uploading ? "Uploading..." : "Upload"}
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      {!canUpload ? (
        <p className="text-xs text-slate-500">Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env.local to enable uploads.</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {value ? (
        <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-3">
          <div className="relative h-20 w-20 overflow-hidden rounded-3xl bg-white">
            <img src={value} alt="Product preview" className="h-full w-full object-cover" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900 line-clamp-1">Preview</p>
            <p className="text-xs text-slate-500 line-clamp-2">{value}</p>
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => onChange("") }>
              <Trash2 className="h-4 w-4" /> Remove image
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
