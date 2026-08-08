import { Client } from "@upstash/qstash";

export function getQStashClient() {
  const token = process.env.QSTASH_TOKEN?.trim();
  if (!token) throw new Error("QSTASH_TOKEN is required.");
  return new Client({ token });
}

export function getQStashDestination(path = "") {
  const configuredUrl = process.env.APP_URL?.trim();
  if (!configuredUrl) throw new Error("APP_URL must be configured for QStash.");

  const base = new URL(configuredUrl);
  if (base.protocol !== "https:") {
    throw new Error("APP_URL must be a publicly reachable HTTPS URL for QStash.");
  }

  const suffix = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${base.origin}${suffix}`;
}

export function getQStashVerificationUrl(path: string) {
  const base = process.env.APP_URL?.trim().replace(/\/$/, "");
  return base ? `${base}${path.startsWith("/") ? path : `/${path}`}` : undefined;
}