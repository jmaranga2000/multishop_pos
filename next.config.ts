import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@react-pdf/renderer", "exceljs", "argon2", "mongoose", "web-push", "nodemailer"],
  experimental: {
    cpus: 2,
    serverActions: {
      bodySizeLimit: "4mb"
    }
  },
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" }
      ]
    }
  ]
};

export default nextConfig;
