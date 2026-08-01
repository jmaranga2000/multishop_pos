import test from "node:test";
import assert from "node:assert/strict";
import { businessSettingsSchema } from "./settings-validator";

test("business settings parse the barcode scanning toggle", () => {
  const parsed = businessSettingsSchema.parse({
    name: "Sample business",
    email: "",
    phone: "",
    address: "",
    taxPin: "",
    currency: "KES",
    timezone: "Africa/Nairobi",
    receiptFooter: "",
    defaultReorderLevel: 10,
    defaultCriticalLevel: 5,
    offlineSessionHours: 24,
    syncIntervalMinutes: 5,
    weeklyReportDay: 1,
    weeklyReportHour: 8,
    posBarcodeScanningEnabled: "true",
  });

  assert.equal(parsed.posBarcodeScanningEnabled, true);
});
