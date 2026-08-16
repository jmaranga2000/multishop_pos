import type { EtimsIntegrationMode } from "@/models/model.types";

export type NormalizedEtimsInvoice = {
  requestReference: string;
  taxpayerPin: string;
  branchCode?: string | null;
  deviceId?: string | null;
  currency: "KES";
  netMinor: number;
  vatMinor: number;
  grossMinor: number;
  lines: Array<{
    itemCode: string;
    quantity: number;
    unitPriceMinor: number;
    netMinor: number;
    vatMinor: number;
    grossMinor: number;
    taxTreatment: "STANDARD" | "ZERO_RATED" | "EXEMPT";
    vatRate: number;
  }>;
};

export type EtimsSubmissionResult = {
  status: "SUCCESS" | "FAILED" | "RETRY_REQUIRED" | "REJECTED";
  providerReference?: string;
  officialInvoiceNumber?: string;
  fiscalDocumentNumber?: string;
  controlCode?: string;
  qrCodeData?: string;
  responseData?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
};

export interface EtimsProvider {
  readonly mode: EtimsIntegrationMode;
  validateSale(invoice: NormalizedEtimsInvoice): Promise<void>;
  submitInvoice(invoice: NormalizedEtimsInvoice): Promise<EtimsSubmissionResult>;
  getStatus(requestReference: string): Promise<EtimsSubmissionResult>;
  cancelInvoice(requestReference: string): Promise<EtimsSubmissionResult>;
}

class UnconfiguredEtimsProvider implements EtimsProvider {
  readonly mode: EtimsIntegrationMode;

  constructor(mode: EtimsIntegrationMode) {
    this.mode = mode;
  }

  async validateSale() {
    throw new Error("No certified KRA eTIMS OSCU/VSCU provider adapter is installed for this deployment.");
  }

  async submitInvoice(): Promise<EtimsSubmissionResult> {
    return {
      status: "FAILED",
      errorCode: "ETIMS_PROVIDER_UNCONFIGURED",
      errorMessage: "No certified KRA eTIMS OSCU/VSCU provider adapter is installed for this deployment.",
    };
  }

  async getStatus(): Promise<EtimsSubmissionResult> {
    return this.submitInvoice();
  }

  async cancelInvoice(): Promise<EtimsSubmissionResult> {
    return this.submitInvoice();
  }
}

export function getEtimsProvider(mode: EtimsIntegrationMode): EtimsProvider {
  // Do not add KRA paths, headers, payload fields, or credentials here. A certified
  // OSCU/VSCU adapter must be implemented from the approved KRA specification.
  return new UnconfiguredEtimsProvider(mode);
}

export function hasConfiguredEtimsProvider() {
  return false;
}