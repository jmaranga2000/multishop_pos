import { randomUUID } from "node:crypto";

function datePart(date = new Date()) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

export function createDocumentNumber(prefix: string, locationCode?: string) {
  const location = locationCode ? `-${locationCode.toUpperCase()}` : "";
  return `${prefix}${location}-${datePart()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}
