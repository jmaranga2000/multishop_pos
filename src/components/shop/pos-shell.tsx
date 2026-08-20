"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Banknote, Camera, CreditCard, FileText, Minus, PackageX, Plus, ScanLine, Search, ShoppingCart, Trash2, WifiOff, X } from "lucide-react";
import { MdPhoneAndroid } from "react-icons/md";
import { toast } from "sonner";
import { offlineDb } from "@/lib/offline/db";
import { listLocalInventoryWithProducts } from "@/services/offline/query-service";
import { createLocalSale } from "@/services/offline/pos-service";
import { useOffline } from "@/components/shop/offline-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buildThermalReceiptHtml, downloadReceiptPdf, type ThermalReceiptData } from "@/components/shop/thermal-receipt";
import { describeSaleLifecycleMessage, type SaleLifecycleStatus } from "@/lib/offline/sale-status";
import { formatMoney, fromMinorUnits, getStockStatus } from "@/lib/utils";
import { CreditLimitOverrideModal } from "@/components/shop/credit-limit-override-modal";
import { calculateVatTotals } from "@/services/tax/tax-service";
import { buildQuotationHtml, downloadQuotationPdf, quotationMessage, type QuotationData } from "@/components/shop/quotation";

type PricingOption = {
  unitId?: string | null;
  unitName?: string | null;
  unitSymbol?: string | null;
  costPriceMinor: number;
  sellingPriceMinor: number;
};

type InventoryEntry = Awaited<ReturnType<typeof listLocalInventoryWithProducts>>[number];

type CartLine = {
  productId: string;
  name: string;
  sku: string;
  unitId?: string | null;
  unitName?: string | null;
  unitSymbol?: string | null;
  quantity: number;
  unitPriceMinor: number;
  unitCostMinor: number;
  taxRate: number;
  taxTreatment: 'STANDARD' | 'ZERO_RATED' | 'EXEMPT';
  etimsItemCode?: string | null;
  available: number;
};

type FrequentProduct = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  inventoryEntry?: InventoryEntry;
};

type PaymentMode = "CASH" | "MPESA" | "CARD" | "BANK" | "CREDIT";
type CheckoutMode = "NORMAL" | "ETIMS";
type EtimsCheckoutAvailability = { available: boolean; permitted: boolean; reason: string | null; configurationRequired: string[]; vatEnabled: boolean; standardVatRate: number; priceTaxMode: "VAT_EXCLUSIVE" | "VAT_INCLUSIVE"; };

type MpesaFlow = "STK_PUSH" | "PAY_TO_TILL" | null;

type ReceiptSettings = {
  businessName?: string | null;
  shopName?: string | null;
  shopLocation?: string | null;
  shopContact?: string | null;
  shopEmail?: string | null;
  taxInfo?: string | null;
  receiptFooter?: string | null;
  cashierName?: string | null;
  returnPolicy?: string | null;
  thankYouMessage?: string | null;
  counterId?: string | null;
  counterName?: string | null;
  paymentInfo?: QuotationData["paymentInfo"];
};

async function addReceiptQrCode(data: ThermalReceiptData) {
  try {
    if (data.checkoutMode === "ETIMS") {
      if (!data.etims?.qrCodeData) return data;
      return { ...data, qrCodeDataUrl: await QRCode.toDataURL(data.etims.qrCodeData, { errorCorrectionLevel: "M", margin: 1, width: 160 }) };
    }
    const payload = [
      "MULTISHOP POS RECEIPT",
      `Receipt: ${data.receiptNumber}`,
      `Date: ${data.occurredAt}`,
      `Total: KES ${(data.grandTotalMinor / 100).toFixed(2)}`,
    ].join("\n");
    return { ...data, qrCodeDataUrl: await QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 160 }) };
  } catch {
    return data;
  }
}
export function PosShell({
  barcodeScanningEnabled = true,
  mpesaEnabled = false,
  mpesaStkEnabled = false,
  mpesaPayToTillEnabled = false,
  mpesaTillNumber,
  shopName,
  registerSessionId,
  canReprintReceipts = false,
  etimsCheckout,
}: {
  barcodeScanningEnabled?: boolean;
  mpesaEnabled?: boolean;
  mpesaStkEnabled?: boolean;
  mpesaPayToTillEnabled?: boolean;
  mpesaTillNumber?: string | null;
  shopName?: string;
  registerSessionId?: string | null;
  canReprintReceipts?: boolean;
  etimsCheckout?: EtimsCheckoutAvailability;
}) {
  const { shopId, online, pendingCount } = useOffline();
  const offlineActive = !online;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>("NORMAL");
  const [selectedUnits, setSelectedUnits] = useState<Record<string, string>>({});
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [unitModalEntry, setUnitModalEntry] = useState<InventoryEntry | null>(null);
  const [unitModalSelected, setUnitModalSelected] = useState<string | null>(null);
  const firstUnitRadioRef = useRef<HTMLInputElement | null>(null);
  const mpesaFlowButtonRef = useRef<HTMLButtonElement | null>(null);
  const [processing, setProcessing] = useState(false);
  const [amountReceived, setAmountReceived] = useState("");
  const [customerName, setCustomerName] = useState("Walk-in customer");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [allCustomers, setAllCustomers] = useState<Array<any>>([]);
  const [customerDetails, setCustomerDetails] = useState<any | null>(null);
  const [discountMinor, setDiscountMinor] = useState(0);
  const [notes, setNotes] = useState("");
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [pendingOverrideData, setPendingOverrideData] = useState<any | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraScanning, setCameraScanning] = useState(false);
  const [cameraScanProgress, setCameraScanProgress] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hardwareScanBuffer, setHardwareScanBuffer] = useState("");
  const hardwareScanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [splitPaymentEnabled, setSplitPaymentEnabled] = useState(false);
  const [splitSecondMethod, setSplitSecondMethod] = useState<"MPESA" | "CREDIT">("MPESA");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const [mpesaOverlayOpen, setMpesaOverlayOpen] = useState(false);
  const [mpesaFlow, setMpesaFlow] = useState<MpesaFlow>(null);
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [mpesaStatus, setMpesaStatus] = useState("Ready");
  const [mpesaReference, setMpesaReference] = useState<string | null>(null);
  const [mpesaPaymentId, setMpesaPaymentId] = useState<string | null>(null);
  const [mpesaSaleLocalReference, setMpesaSaleLocalReference] = useState<string | null>(null);
  const [mpesaConfirmedAmountMinor, setMpesaConfirmedAmountMinor] = useState<number | null>(null);
  const [mpesaAmount, setMpesaAmount] = useState("");
  const [mpesaInFlight, setMpesaInFlight] = useState(false);
  const [mpesaError, setMpesaError] = useState<string | null>(null);
  const [manualConfirmationCandidates, setManualConfirmationCandidates] = useState<Array<{ name: string; phone: string; amountMinor: number }>>([]);
  const [manualConfirmationSelection, setManualConfirmationSelection] = useState<string | null>(null);
  const [manualConfirmationChecking, setManualConfirmationChecking] = useState(false);
  const [manualConfirmationConfirmed, setManualConfirmationConfirmed] = useState(false);
  const [completedSale, setCompletedSale] = useState<ThermalReceiptData | null>(null);
  const [completedSaleLocalId, setCompletedSaleLocalId] = useState<string | null>(null);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [reprintInFlight, setReprintInFlight] = useState(false);
  const [shareInFlight, setShareInFlight] = useState(false);
  const [quotation, setQuotation] = useState<QuotationData | null>(null);
  const [loadedQuotationId, setLoadedQuotationId] = useState<string | null>(null);
  const [quotationSearchNumber, setQuotationSearchNumber] = useState("");
  const [quotationSearchBusy, setQuotationSearchBusy] = useState(false);
  const [saleLifecycleStatus, setSaleLifecycleStatus] = useState<SaleLifecycleStatus>("LOCAL_ONLY");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const productQuery = useLiveQuery(() => listLocalInventoryWithProducts(shopId), [shopId], []);
  const products = useMemo(() => productQuery ?? [], [productQuery]);
  const saleItemsQuery = useLiveQuery(() => offlineDb.offlineSaleItems.toArray(), [], []);
  const completedSaleRecord = useLiveQuery(() => completedSaleLocalId ? offlineDb.offlineSales.get(completedSaleLocalId) : undefined, [completedSaleLocalId], undefined);

  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map((item) => item.product?.categoryName).filter(Boolean) as string[]))], [products]);
  const activeCompletedSale = useMemo(() => completedSale ? { ...completedSale, receiptNumber: completedSaleRecord?.receiptNumber ?? completedSale.receiptNumber } : completedSale, [completedSale, completedSaleRecord]);
  const activeSaleLifecycleStatus = useMemo(() => completedSaleRecord ? (completedSaleRecord.status as SaleLifecycleStatus) : saleLifecycleStatus, [completedSaleRecord, saleLifecycleStatus]);
  const filtered = useMemo(() => products.filter((entry) => {
    const product = entry.product!;
    const matches = `${product.name} ${product.sku} ${product.barcode ?? ""}`.toLowerCase().includes(query.toLowerCase());
    return matches && (category === "All" || product.categoryName === category);
  }), [products, query, category]);
  const frequentProducts = useMemo(() => {
    const counts = new Map<string, { productId: string; name: string; sku: string; quantity: number }>();
    (saleItemsQuery ?? []).forEach((item) => {
      const current = counts.get(item.productId) ?? { productId: item.productId, name: item.productName, sku: item.sku, quantity: 0 };
      current.quantity += item.quantity;
      counts.set(item.productId, current);
    });
    return Array.from(counts.values())
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 6)
      .map((item) => ({
        ...item,
        inventoryEntry: products.find((entry) => entry.product?.id === item.productId),
      }))
      .filter((item) => item.inventoryEntry) as FrequentProduct[];
  }, [saleItemsQuery, products]);
  const totalMinor = cart.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceMinor), 0);
  const etimsPreview = useMemo(() => calculateVatTotals(
    cart.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      taxTreatment: item.taxTreatment,
      vatRate: item.taxRate || etimsCheckout?.standardVatRate || 0,
    })),
    etimsCheckout?.priceTaxMode ?? 'VAT_EXCLUSIVE',
  ), [cart, etimsCheckout?.priceTaxMode, etimsCheckout?.standardVatRate]);
  const checkoutTotalMinor = checkoutMode === 'ETIMS' ? etimsPreview.grossMinor : totalMinor;
  const receivedMinor = Math.round(Number(amountReceived || 0) * 100);
  const changeDueMinor = receivedMinor - checkoutTotalMinor;

  function setCartQuantity(productId: string, unitId: string | null | undefined, nextQuantity: number) {
    const normalized = Math.round(nextQuantity * 100) / 100;
    setCart((current) => current.flatMap((item) => {
      if (item.productId !== productId || item.unitId !== unitId) return [item];
      if (normalized <= 0) return [];
      if (normalized > item.available) {
        toast.warning(`Only ${item.available} units are projected to be available`);
        return [item];
      }
      return [{ ...item, quantity: normalized }];
    }));
  }

  const getPricingOption = useCallback((entry: InventoryEntry): PricingOption => {
    const product = entry.product!;
    const selectedUnitId = selectedUnits[product.id];
    if (product.pricingOptions?.length) {
      const match = product.pricingOptions.find((option) => option.unitId === selectedUnitId);
      return match ?? product.pricingOptions[0];
    }
    return {
      unitId: product.unitId ?? null,
      unitName: product.unitName ?? null,
      unitSymbol: product.unitSymbol ?? null,
      costPriceMinor: entry.costPriceMinor,
      sellingPriceMinor: entry.sellingPriceMinor,
    };
  }, [selectedUnits]);

  const add = useCallback((entry: InventoryEntry, options?: { fromBarcode?: boolean }) => {
    const product = entry.product!;
    if (entry.projectedQuantity <= 0 || !entry.isAvailable) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    if (product.status !== "ACTIVE") {
      toast.error(`${product.name} is not active`);
      return;
    }
    if (product.pricingOptions?.length && product.pricingOptions.length > 1 && !selectedUnits[product.id] && !options?.fromBarcode) {
      setUnitModalEntry(entry);
      setUnitModalSelected(product.pricingOptions[0].unitId ?? null);
      setUnitModalOpen(true);
      return;
    }
    const pricingOption = getPricingOption(entry);
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id && item.unitId === pricingOption.unitId);
      if (existing) {
        if (existing.quantity >= entry.projectedQuantity) {
          toast.warning(`Only ${entry.projectedQuantity} units are projected to be available`);
          return current;
        }
        return current.map((item) => item.productId === product.id && item.unitId === pricingOption.unitId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitId: pricingOption.unitId,
          unitName: pricingOption.unitName,
          unitSymbol: pricingOption.unitSymbol,
          quantity: 1,
          unitPriceMinor: pricingOption.sellingPriceMinor,
          unitCostMinor: pricingOption.costPriceMinor,
          taxRate: Number(product.taxRate ?? 0),
          taxTreatment: product.taxTreatment ?? 'STANDARD',
          etimsItemCode: product.etimsItemCode ?? null,
          available: entry.projectedQuantity,
        },
      ];
    });
    toast.success(`${product.name} added to cart`);
  }, [getPricingOption, selectedUnits]);

  const confirmUnitSelection = useCallback(() => {
    if (!unitModalEntry) {
      setUnitModalOpen(false);
      return;
    }
    const entry = unitModalEntry;
    const product = entry.product!;
    const selectedId = unitModalSelected;
    const pricingOption = product.pricingOptions?.find((o) => o.unitId === selectedId) ?? getPricingOption(entry);
    if (product.id && selectedId) {
      setSelectedUnits((cur) => ({ ...cur, [product.id]: selectedId }));
    }
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id && item.unitId === pricingOption.unitId);
      if (existing) {
        if (existing.quantity >= entry.projectedQuantity) {
          toast.warning(`Only ${entry.projectedQuantity} units are projected to be available`);
          return current;
        }
        return current.map((item) => item.productId === product.id && item.unitId === pricingOption.unitId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitId: pricingOption.unitId,
          unitName: pricingOption.unitName,
          unitSymbol: pricingOption.unitSymbol,
          quantity: 1,
          unitPriceMinor: pricingOption.sellingPriceMinor,
          unitCostMinor: pricingOption.costPriceMinor,
          taxRate: Number(product.taxRate ?? 0),
          taxTreatment: product.taxTreatment ?? 'STANDARD',
          etimsItemCode: product.etimsItemCode ?? null,
          available: entry.projectedQuantity,
        },
      ];
    });
    toast.success(`${product.name} added to cart`);
    setUnitModalOpen(false);
    setUnitModalEntry(null);
  }, [getPricingOption, unitModalEntry, unitModalSelected]);

  function cancelUnitSelection() {
    setUnitModalOpen(false);
    setUnitModalEntry(null);
    setUnitModalSelected(null);
  }

  useEffect(() => {
    if (unitModalOpen) {
      setTimeout(() => {
        firstUnitRadioRef.current?.focus();
      }, 0);
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") cancelUnitSelection();
      }
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [unitModalOpen]);

  useEffect(() => {
    if (mpesaOverlayOpen && mpesaFlow === null) {
      setTimeout(() => {
        mpesaFlowButtonRef.current?.focus();
      }, 0);
    }
    function onKey(e: KeyboardEvent) {
      if (mpesaOverlayOpen && e.key === "Escape") {
        setMpesaOverlayOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mpesaOverlayOpen, mpesaFlow]);

  useEffect(() => {
    let active = true;
    async function loadReceiptSettings() {
      try {
        const response = await fetch("/api/shop/receipt-settings");
        const payload = await response.json();
        if (!active) return;
        if (payload.ok) setReceiptSettings(payload);
      } catch {
        if (active) setReceiptSettings(null);
      }
    }
    void loadReceiptSettings();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadCustomers() {
      try {
        const res = await fetch("/api/shop/customers");
        if (res.ok && active) {
          const list = await res.json();
          setAllCustomers(list);
        }
      } catch {
        // Silently fail if customers can't be loaded
      }
    }
    void loadCustomers();
    return () => { active = false; };
  }, []);

  const handleBarcodeScan = useCallback(async (code: string) => {
    const normalized = code.trim();
    if (!normalized) return;
    const match = products.find((entry) => entry.product?.barcode?.trim().toLowerCase() === normalized.toLowerCase());
    if (!match?.product) {
      toast.error("Unknown barcode");
      return;
    }
    if (match.product.status !== "ACTIVE") {
      toast.error(`${match.product.name} is not active`);
      return;
    }
    if (!match.isAvailable || match.projectedQuantity <= 0) {
      toast.warning(`${match.product.name} is out of stock`);
      return;
    }
    const existingLine = cart.find((item) => item.productId === match.product!.id);
    if (existingLine) {
      if (existingLine.quantity >= match.projectedQuantity) {
        toast.warning(`Only ${match.projectedQuantity} units are projected to be available`);
        return;
      }
    }
    add(match, { fromBarcode: true });
    setBarcodeInput("");
  }, [cart, products, add]);

  useEffect(() => {
    if (!barcodeScanningEnabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const isEditableField = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;

      // Native input handling owns typing in search, barcode, and notes fields. Hardware scanners are captured only when no editable field has focus.
      if (isEditableField) return;
      if (event.key === "Escape") {
        if (cameraActive) {
          setCameraActive(false);
          streamRef.current?.getTracks().forEach((track) => track.stop());
        }
        setHardwareScanBuffer("");
        if (hardwareScanTimeoutRef.current) clearTimeout(hardwareScanTimeoutRef.current);
        return;
      }

      if (event.key === "Enter") {
        if (hardwareScanBuffer.trim()) {
          event.preventDefault();
          void handleBarcodeScan(hardwareScanBuffer.trim());
          setHardwareScanBuffer("");
          if (hardwareScanTimeoutRef.current) clearTimeout(hardwareScanTimeoutRef.current);
        }
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setHardwareScanBuffer((prev) => prev + event.key);

        if (hardwareScanTimeoutRef.current) clearTimeout(hardwareScanTimeoutRef.current);
        hardwareScanTimeoutRef.current = setTimeout(() => {
          setHardwareScanBuffer("");
        }, 2000);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (hardwareScanTimeoutRef.current) clearTimeout(hardwareScanTimeoutRef.current);
    };
  }, [barcodeScanningEnabled, cameraActive, barcodeInput, hardwareScanBuffer, handleBarcodeScan]);

  async function startCameraScan() {
    if (!barcodeScanningEnabled) return;
    const detectorCtor = (window as Window & { BarcodeDetector?: new (options?: { formats?: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    if (!detectorCtor) {
      toast.error("Camera scanning is not supported in this browser");
      return;
    }
    if (cameraActive) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraActive(false);
      setCameraScanning(false);
      setCameraScanProgress(0);
      setCameraError(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new detectorCtor({ formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code", "data_matrix", "aztec"] });
      setCameraActive(true);
      setCameraScanning(true);
      setCameraScanProgress(0);
      let scanAttempts = 0;
      const maxAttempts = 90;
      let stopped = false;
      let intervalId: number | null = null;

      const stopScan = () => {
        if (stopped) return;
        stopped = true;
        if (intervalId !== null) {
          window.clearInterval(intervalId);
        }
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        setCameraActive(false);
        setCameraScanning(false);
        setCameraScanProgress(0);
      };

      const detectLoop = async () => {
        if (!streamRef.current || !videoRef.current) {
          stopScan();
          return;
        }

        if (videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          return;
        }

        scanAttempts += 1;
        setCameraScanProgress(Math.min(100, (scanAttempts / maxAttempts) * 100));

        if (scanAttempts > maxAttempts) {
          toast.info("Camera scan timed out. Try again.");
          stopScan();
          return;
        }

        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const value = barcodes[0]?.rawValue?.trim();
            if (value) {
              toast.success(`Barcode detected: ${value}`);
              await handleBarcodeScan(value);
              stopScan();
              return;
            }
          }
        } catch {
          // Continue scanning silently.
        }
      };

      intervalId = window.setInterval(detectLoop, 500);
    } catch (error) {
      const errorMessage = error instanceof DOMException ? error.name : "Unknown error";
      if (errorMessage === "NotAllowedError") {
        setCameraError("Camera permission denied. Please enable camera access in your browser settings.");
        toast.error("Camera permission denied. Please enable camera access.");
      } else if (errorMessage === "NotFoundError") {
        setCameraError("No camera device found.");
        toast.error("No camera device found.");
      } else {
        setCameraError("Unable to access the camera.");
      }
      setCameraScanning(false);
    }
  }

  function changeQuantity(productId: string, unitId: string | null | undefined, delta: number) {
    setCart((current) => current.flatMap((item) => {
      if (item.productId !== productId || item.unitId !== unitId) return [item];
      const quantity = Math.round((item.quantity + delta) * 100) / 100;
      if (quantity <= 0) return [];
      if (quantity > item.available) {
        toast.warning(`Only ${item.available} units are projected to be available`);
        return [item];
      }
      return [{ ...item, quantity }];
    }));
  }

  function resetSaleState() {
    setCart([]);
    setAmountReceived("");
    setCustomerName("Walk-in customer");
    setDiscountMinor(0);
    setNotes("");
    setSplitPaymentEnabled(false);
    setPaymentMode("CASH");
    setMpesaFlow(null);
    setMpesaPhone("");
    setMpesaStatus("Ready");
    setMpesaReference(null);
    setMpesaPaymentId(null);
    setMpesaSaleLocalReference(null);
    setMpesaConfirmedAmountMinor(null);
    setMpesaError(null);
    setManualConfirmationCandidates([]);
    setManualConfirmationSelection(null);
    setManualConfirmationChecking(false);
    setCompletedSale(null);
    setCompletedSaleLocalId(null);
    setLoadedQuotationId(null);
    setSaleLifecycleStatus("LOCAL_ONLY");
    setQuotation(null);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  }

  function buildQuotationSnapshot(): QuotationData | null {
    if (!cart.length) {
      toast.info("Add products to the cart before creating a quotation.");
      return null;
    }
    const quotationNumber = `QT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const subtotal = cart.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceMinor), 0);
    const discount = checkoutMode === "ETIMS" ? 0 : discountMinor;
    const issuedAt = new Date();
    const validUntil = new Date(issuedAt);
    validUntil.setDate(validUntil.getDate() + 14);
    return {
      shopName: shopName || "MultiShop POS",
      businessName: receiptSettings?.businessName,
      physicalAddress: receiptSettings?.shopLocation,
      phoneNumber: receiptSettings?.shopContact,
      email: receiptSettings?.shopEmail,
      quotationNumber,
      issuedAt: issuedAt.toISOString(),
      validUntil: validUntil.toISOString(),
      cashierName: receiptSettings?.cashierName ?? "Cashier",
      counterName: receiptSettings?.counterName ?? "Counter",
      customerName,
      items: cart.map((item) => ({ productId: item.productId, sku: item.sku, name: item.name, quantity: item.quantity, unitName: item.unitName, unitSymbol: item.unitSymbol, unitPriceMinor: item.unitPriceMinor, lineTotalMinor: Math.round(item.quantity * item.unitPriceMinor), vatRate: item.taxRate, vatMinor: Math.round(item.quantity * item.unitPriceMinor * Math.max(0, item.taxRate) / (100 + Math.max(0, item.taxRate))) })),
      subtotalMinor: subtotal,
      discountMinor: discount,
      vatMinor: etimsPreview.vatMinor,
      totalMinor: Math.max(0, subtotal - discount + etimsPreview.vatMinor),
      notes,
      paymentInfo: receiptSettings?.paymentInfo,
    };
  }

  function createQuotation() {
    const snapshot = buildQuotationSnapshot();
    if (snapshot) setQuotation(snapshot);
  }

  async function convertQuotationToSale() {
    const number = quotationSearchNumber.trim();
    if (!number) {
      toast.info("Enter a quotation number first.");
      return;
    }
    setQuotationSearchBusy(true);
    try {
      const response = await fetch(`/api/shop/quotations?number=${encodeURIComponent(number)}`);
      const result = await response.json() as { quotation?: { id: string; status: string; validUntil: string; customerId?: string | null; customerName: string; discountTotal: number; items: Array<{ productId: string; productName: string; sku: string; unitId?: string | null; unitName?: string | null; unitSymbol?: string | null; quantity: number; unitPriceMinor: number; vatRate: number }> } | null; error?: string };
      if (!response.ok || !result.quotation) throw new Error(result.error ?? "Quotation was not found.");
      const saved = result.quotation;
      if (saved.status !== "ISSUED") throw new Error(`This quotation is already ${saved.status.toLowerCase()}.`);
      if (new Date(saved.validUntil).getTime() <= Date.now()) throw new Error("This quotation has expired and cannot be converted.");
      const nextCart: CartLine[] = [];
      for (const item of saved.items) {
        const inventory = products.find((entry) => entry.product?.id === item.productId);
        if (!inventory || !inventory.isAvailable || inventory.projectedQuantity < item.quantity) throw new Error(`${item.productName} no longer has enough current stock.`);
        nextCart.push({ productId: item.productId, name: item.productName, sku: item.sku, unitId: item.unitId ?? null, unitName: item.unitName ?? null, unitSymbol: item.unitSymbol ?? null, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor, unitCostMinor: inventory.costPriceMinor, taxRate: item.vatRate, taxTreatment: "STANDARD", etimsItemCode: inventory.product?.etimsItemCode ?? null, available: inventory.projectedQuantity });
      }
      setCart(nextCart);
      setLoadedQuotationId(saved.id);
      setCustomerId(saved.customerId ?? null);
      setCustomerName(saved.customerName);
      setDiscountMinor(saved.discountTotal);
      setQuotationSearchNumber("");
      toast.success(`Quotation ${number} loaded. Confirm payment to complete the sale.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to convert quotation.");
    } finally {
      setQuotationSearchBusy(false);
    }
  }

  async function saveQuotation() {
    const snapshot = quotation ?? buildQuotationSnapshot();
    if (!snapshot) return null;
    setShareInFlight(true);
    try {
      const response = await fetch("/api/shop/quotations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ counterId: receiptSettings?.counterId, counterName: snapshot.counterName, cashierName: snapshot.cashierName, customerId, customerName: snapshot.customerName, quotationNumber: snapshot.quotationNumber, issuedAt: snapshot.issuedAt, validUntil: snapshot.validUntil, subtotal: snapshot.subtotalMinor, discountTotal: snapshot.discountMinor, vatTotal: snapshot.vatMinor, grandTotal: snapshot.totalMinor, notes: snapshot.notes, items: snapshot.items }) });
      const result = await response.json() as { ok?: boolean; error?: string; pdfUrl?: string };
      if (!response.ok || !result.ok || !result.pdfUrl) throw new Error(result.error ?? "Unable to save quotation.");
      setQuotation({ ...snapshot, shareUrl: result.pdfUrl });
      toast.success("Quotation saved as issued");
      return result.pdfUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save quotation.");
      return null;
    } finally {
      setShareInFlight(false);
    }
  }

  function printQuotation() {
    if (!quotation) return;
    const printWindow = window.open("", "_blank", "width=900,height=800");
    if (!printWindow) return;
    printWindow.document.write(buildQuotationHtml(quotation));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  async function shareQuotationWhatsapp() {
    if (!quotation) return;
    const url = quotation.shareUrl ?? await saveQuotation();
    if (!url) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(quotationMessage({ ...quotation, shareUrl: url }, url))}`, "_blank", "noopener,noreferrer");
  }

  async function emailQuotation() {
    if (!quotation) return;
    const url = quotation.shareUrl ?? await saveQuotation();
    if (!url) return;
    window.location.assign(`mailto:?subject=${encodeURIComponent(`Quotation ${quotation.quotationNumber}`)}&body=${encodeURIComponent(quotationMessage({ ...quotation, shareUrl: url }, url))}`);
  }

  function buildReceiptNumber(localId: string) {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `KSM-${stamp}-${localId.slice(0, 6).toUpperCase()}`;
  }

  async function checkoutEtims() {
    if (!registerSessionId || !cart.length || processing) return;
    if (!online) {
      toast.error("eTIMS checkout is currently unavailable because an internet connection is required.");
      return;
    }
    if (!etimsCheckout?.available) {
      toast.error(etimsCheckout?.reason ?? "eTIMS checkout is not configured for this shop.");
      return;
    }
    if (discountMinor > 0) {
      toast.error("Discounted eTIMS sales require the certified provider discount mapping before use.");
      return;
    }

    const total = etimsPreview.grossMinor;
    let payments: Array<{ method: "CASH" | "MPESA" | "CARD" | "BANK_TRANSFER" | "CREDIT"; amountMinor: number; reference: string | null }>;
    if (splitPaymentEnabled) {
      const cashMinor = Math.round(Number(amountReceived || 0) * 100);
      const secondMinor = Math.round(Number(mpesaAmount || 0) * 100);
      const secondMethod = splitSecondMethod === "MPESA" ? "MPESA" : "CREDIT";
      payments = [
        { method: "CASH", amountMinor: cashMinor, reference: null },
        { method: secondMethod, amountMinor: secondMinor, reference: secondMethod === "MPESA" ? mpesaReference : null },
      ].filter((payment): payment is { method: 'CASH' | 'MPESA' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT'; amountMinor: number; reference: string | null } => payment.amountMinor > 0);
    } else {
      if (paymentMode !== "CREDIT" && receivedMinor < total) {
        toast.error("Amount received is lower than the eTIMS total.");
        return;
      }
      payments = [{
        method: (paymentMode === "BANK" ? "BANK_TRANSFER" : paymentMode) as "CASH" | "MPESA" | "CARD" | "BANK_TRANSFER" | "CREDIT",
        amountMinor: paymentMode === "CREDIT" ? total : paymentMode === "MPESA" ? total : receivedMinor,
        reference: mpesaReference,
      }];
    }
    if (payments.reduce((sum, payment) => sum + payment.amountMinor, 0) < total) {
      toast.error("Payment total is lower than the eTIMS total.");
      return;
    }
    const mpesaPayment = payments.find((payment) => payment.method === "MPESA");
    if (mpesaPayment && (!mpesaPaymentId || !manualConfirmationConfirmed || !mpesaReference || mpesaConfirmedAmountMinor !== mpesaPayment.amountMinor)) {
      toast.error("Wait for the exact M-Pesa payment confirmation before fiscalizing this sale.");
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch("/api/shop/etims/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutRequestId: crypto.randomUUID(),
          registerSessionId,
          customerId,
          customerName,
          discountMinor,
          note: notes || null,
          payments,
          items: cart.map((item) => ({ productId: item.productId, unitId: item.unitId ?? null, quantity: item.quantity })),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.etims?.errorMessage ?? payload.error ?? "eTIMS submission failed. The sale was not fiscalized.");
      }
      const receiptData: ThermalReceiptData = {
        businessName: receiptSettings?.businessName ?? receiptSettings?.shopName ?? (shopName || "MultiShop POS"),
        shopLocation: receiptSettings?.shopLocation ?? null,
        shopContact: receiptSettings?.shopContact ?? null,
        taxInfo: receiptSettings?.taxInfo ?? null,
        receiptNumber: payload.receiptNumber,
        occurredAt: new Date().toISOString(),
        cashierName: receiptSettings?.cashierName ?? "Current cashier",
        customerName: customerName || "Walk-in customer",
        checkoutMode: "ETIMS",
        taxableMinor: payload.totals.taxableMinor,
        vatRate: payload.totals.vatRate,
        etims: payload.etims,
        items: cart.map((item, index) => ({
          name: item.name,
          quantity: item.quantity,
          unitName: item.unitName,
          unitSymbol: item.unitSymbol,
          unitPriceMinor: item.unitPriceMinor,
          lineTotalMinor: etimsPreview.lines[index]?.grossMinor ?? Math.round(item.quantity * item.unitPriceMinor),
        })),
        subtotalMinor: etimsPreview.netMinor,
        discountMinor: 0,
        taxMinor: payload.totals.vatMinor,
        grandTotalMinor: payload.totals.grossMinor,
        paymentMethod: payments.length === 1 ? payments[0].method : "Split payment",
        amountPaidMinor: payments.filter((payment) => payment.method !== "CREDIT").reduce((sum, payment) => sum + payment.amountMinor, 0),
        changeDueMinor: Math.max(0, payments.reduce((sum, payment) => sum + payment.amountMinor, 0) - payload.totals.grossMinor),
        receiptFooter: receiptSettings?.receiptFooter ?? null,
        returnPolicy: receiptSettings?.returnPolicy ?? "Returns accepted within 7 days with original receipt.",
        thankYouMessage: receiptSettings?.thankYouMessage ?? "Thank you for shopping with us.",
      };
      setCompletedSale(await addReceiptQrCode(receiptData));
      setCompletedSaleLocalId(null);
      setSaleLifecycleStatus("SYNCED");
      setCart([]);
      setAmountReceived("");
      setMpesaAmount("");
      setSplitPaymentEnabled(false);
      toast.success("eTIMS sale fiscalized successfully", { description: `Receipt: ${payload.receiptNumber}` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "eTIMS submission failed. The sale was not fiscalized.");
    } finally {
      setProcessing(false);
    }
  }
  async function checkout() {
    if (!registerSessionId) {
      toast.error("Open a register session before completing a sale.");
      return;
    }
    if (!cart.length || processing) return;
    if (checkoutMode === 'ETIMS') {
      await checkoutEtims();
      return;
    }

    // Handle split payment validation
    if (splitPaymentEnabled) {
      const cashAmount = Math.round(Number(amountReceived || 0) * 100);
      const secondAmountMinor = Math.round(Number(mpesaAmount || 0) * 100);
      const totalPaymentMinor = cashAmount + secondAmountMinor;

      if (totalPaymentMinor < totalMinor) {
        toast.error("Total split payment is lower than the sale total");
        return;
      }

      if (cashAmount < 0 || secondAmountMinor < 0) {
        toast.error("Payment amounts cannot be negative");
        return;
      }
    } else {
      // Regular single payment validation (except for full-credit sales)
      if (paymentMode !== "CREDIT" && receivedMinor < totalMinor) {
        toast.error("Amount received is lower than the sale total");
        return;
      }
    }

    const requiredMpesaAmountMinor = splitPaymentEnabled && splitSecondMethod === "MPESA"
      ? Math.round(Number(mpesaAmount || 0) * 100)
      : paymentMode === "MPESA" ? totalMinor : 0;
    if (requiredMpesaAmountMinor > 0 && (!mpesaPaymentId || !mpesaSaleLocalReference || !manualConfirmationConfirmed || !mpesaReference || mpesaConfirmedAmountMinor !== requiredMpesaAmountMinor)) {
      toast.error("Wait for the exact M-Pesa payment confirmation before completing this sale.");
      return;
    }

    setProcessing(true);
    try {
      // Build payments array
      let payments: Array<{
        method: "CASH" | "MPESA" | "CARD" | "BANK_TRANSFER" | "CREDIT";
        amountMinor: number;
        reference: string | null;
      }> = [];
      let amountPaidMinorForSale = 0;

      if (splitPaymentEnabled) {
        const cashAmount = Math.round(Number(amountReceived || 0) * 100);
        const secondAmountMinor = Math.round(Number(mpesaAmount || 0) * 100);
        const secondMethod = splitSecondMethod === "MPESA" ? "MPESA" : "CREDIT";
        payments = [
          {
            method: "CASH" as const,
            amountMinor: cashAmount,
            reference: null,
          },
          {
            method: secondMethod as "MPESA" | "CREDIT",
            amountMinor: secondAmountMinor,
            reference: splitSecondMethod === "MPESA" ? (mpesaReference ?? null) : null,
          },
        ].filter((p) => p.amountMinor > 0) as Array<{
          method: "CASH" | "MPESA" | "CARD" | "CREDIT" | "BANK_TRANSFER";
          amountMinor: number;
          reference: string | null;
        }>;
        amountPaidMinorForSale = payments.filter((p) => p.method !== "CREDIT").reduce((s, p) => s + p.amountMinor, 0);
      } else if (paymentMode === "CREDIT") {
        // Full sale on credit. Require a selected customer.
        if (!customerId) {
          toast.error("Please select a customer for credit sales.");
          setProcessing(false);
          return;
        }
        payments = [
          {
            method: "CREDIT",
            amountMinor: totalMinor,
            reference: null,
          },
        ];
        amountPaidMinorForSale = 0;
      } else {
        payments = [
          {
            method: (paymentMode === "BANK" ? "BANK_TRANSFER" : paymentMode) as
              | "CASH"
              | "MPESA"
              | "CARD"
              | "BANK_TRANSFER"
              | "CREDIT",
            amountMinor: paymentMode === "MPESA" ? totalMinor : receivedMinor,
            reference: mpesaReference ?? null,
          },
        ];
        amountPaidMinorForSale = receivedMinor;
      }

      if (!payments.length) {
        throw new Error("At least one payment method must be specified.");
      }

      // If any credit portion is present, ensure a customer is selected and credit limit is not exceeded
      const creditPortions = payments.filter(p => p.method === "CREDIT");
      if (creditPortions.length > 0) {
        if (!customerId) {
          toast.error("Please select a customer for credit sales.");
          setProcessing(false);
          return;
        }
        // ensure customerDetails loaded
        if (!customerDetails) {
          try {
            const res = await fetch(`/api/shop/customers/${customerId}`);
            if (res.ok) setCustomerDetails(await res.json());
          } catch {}
        }
        // Block credit sales for suspended or restricted accounts client-side as well
        if (customerDetails?.status && (customerDetails.status === "SUSPENDED" || customerDetails.status === "CREDIT_RESTRICTED")) {
          toast.error("This customer's account is not eligible for credit purchases.");
          setProcessing(false);
          return;
        }
        const totalCreditMinor = creditPortions.reduce((s, p) => s + p.amountMinor, 0);
        const available = (customerDetails?.creditLimit ?? 0) - (customerDetails?.cachedOutstandingMinor ?? 0);
        if (totalCreditMinor > available) {
          // Instead of blocking, show override modal
          setPendingOverrideData({
            customerId,
            totalCreditMinor,
            creditLimit: customerDetails?.creditLimit ?? 0,
            payments,
          });
          setOverrideModalOpen(true);
          setProcessing(false);
          return;
        }
      }

      const totalPaidMinor = payments.reduce((sum, p) => sum + p.amountMinor, 0);
      const paymentMethod = payments.length === 1 ? payments[0].method : "SPLIT";
      const normalizedPaymentMethod = paymentMethod;

      const sale = await createLocalSale({
        shopId,
        localId: payments.some((payment) => payment.method === "MPESA") ? (mpesaSaleLocalReference ?? undefined) : undefined,
        registerSessionId,
        customerId: customerId ?? undefined,
        customerName: customerName ?? null,
        payments,
        amountPaidMinor: amountPaidMinorForSale,
        items: cart.map((item) => ({
          productId: item.productId,
          productName: item.name,
          sku: item.sku,
          unitId: item.unitId,
          unitName: item.unitName,
          unitSymbol: item.unitSymbol,
          quantity: item.quantity,
          unitPriceMinor: item.unitPriceMinor,
          unitCostMinor: item.unitCostMinor,
          taxRate: item.taxRate,
        })),
      });
      if (loadedQuotationId && online) {
        const conversionResponse = await fetch("/api/shop/quotations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quotationId: loadedQuotationId, saleId: sale.localId }) });
        if (!conversionResponse.ok) throw new Error("The quotation could not be marked as converted. The sale was not finalized.");
        setLoadedQuotationId(null);
      }
      const receiptNumber = sale.receiptNumber ?? buildReceiptNumber(sale.localId);
      
      // Determine display payment method
      let displayPaymentMethod = "Cash";
      if (normalizedPaymentMethod === "MPESA") displayPaymentMethod = "M-Pesa";
      else if (normalizedPaymentMethod === "CARD") displayPaymentMethod = "Card";
      else if (normalizedPaymentMethod === "BANK_TRANSFER") displayPaymentMethod = "Bank Transfer";
      else if (normalizedPaymentMethod === "CREDIT") displayPaymentMethod = "Credit";
      else if (paymentMethod === "SPLIT") displayPaymentMethod = `Split (${payments.map((p) => p.method).join(" + ")})`;

      const creditAmountMinor = payments.filter((p) => p.method === "CREDIT").reduce((s, p) => s + p.amountMinor, 0);
      const expectedOutstanding = (customerDetails?.cachedOutstandingMinor ?? 0) + creditAmountMinor;

      const receiptData: ThermalReceiptData = {
        businessName: receiptSettings?.businessName ?? receiptSettings?.shopName ?? (shopName || "MultiShop POS"),
        shopLocation: receiptSettings?.shopLocation ?? null,
        shopContact: receiptSettings?.shopContact ?? null,
        taxInfo: receiptSettings?.taxInfo ?? null,
        receiptNumber,
        occurredAt: sale.occurredAt,
        cashierName: receiptSettings?.cashierName ?? "Current cashier",
        customerName: customerName || "Walk-in customer",
        items: cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitName: item.unitName,
          unitSymbol: item.unitSymbol,
          unitPriceMinor: item.unitPriceMinor,
          lineTotalMinor: Math.round(item.quantity * item.unitPriceMinor),
        })),
        subtotalMinor: totalMinor,
        discountMinor,
        taxMinor: 0,
        grandTotalMinor: totalMinor - discountMinor,
        paymentMethod: displayPaymentMethod,
        amountPaidMinor: amountPaidMinorForSale,
        creditAmountMinor: creditAmountMinor > 0 ? creditAmountMinor : undefined,
        outstandingMinor: typeof customerDetails?.cachedOutstandingMinor === "number" ? expectedOutstanding : undefined,
        changeDueMinor: Math.max(0, amountPaidMinorForSale - totalMinor),
        paymentReference: sale.paymentReference ?? null,
        receiptFooter: receiptSettings?.receiptFooter ?? null,
        returnPolicy: receiptSettings?.returnPolicy ?? "Returns accepted within 7 days with original receipt.",
        thankYouMessage: receiptSettings?.thankYouMessage ?? "Thank you for shopping with us.",
      };
      setCompletedSale(await addReceiptQrCode(receiptData));
      setCompletedSaleLocalId(sale.localId);
      setSaleLifecycleStatus(online ? "PENDING_SYNC" : "LOCAL_ONLY");
      setCart([]);
      setAmountReceived("");
      setMpesaAmount("");
      setSplitPaymentEnabled(false);
      toast.success(online ? "Sale completed and submitted for synchronization" : "Offline sale saved", { description: `Receipt: ${receiptNumber}` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete sale");
    } finally {
      setProcessing(false);
    }
  }

  async function handleOverrideApprove(reason: string) {
    if (!pendingOverrideData) return;
    
    try {
      // Submit override approval to server
      const res = await fetch("/api/shop/customers/credit-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: "pending", // This will be created after override
          customerId: pendingOverrideData.customerId,
          overrideReason: reason,
          amountMinor: pendingOverrideData.totalCreditMinor,
        }),
      });

      if (!res.ok) throw new Error("Override approval failed");

      // Close modal and proceed with sale creation
      setOverrideModalOpen(false);
      setPendingOverrideData(null);
      
      // Re-run checkout with override approved (will pass credit check now since override is logged)
      setProcessing(true);
      await checkout();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Override approval failed");
    }
  }

  function buildReceiptSummary(data: ThermalReceiptData) {
    return [
      `Receipt ${data.receiptNumber}`,
      `Total paid: ${formatMoney(fromMinorUnits(data.grandTotalMinor))}`,
      `Payment method: ${data.paymentMethod}`,
    ].join("\n");
  }

  function handlePrintReceipt() {
    if (!activeCompletedSale) return;
    const html = buildThermalReceiptHtml(activeCompletedSale);
    const printWindow = window.open("", "_blank", "width=420,height=760");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  async function handleDownloadReceiptPdf() {
    if (!activeCompletedSale) return;
    await downloadReceiptPdf(activeCompletedSale);
  }

  async function handleShareWhatsapp() {
    if (!activeCompletedSale) return;
    setShareInFlight(true);
    try {
      const response = await fetch("/api/shop/receipts/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activeCompletedSale),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to create receipt link.");
      const message = encodeURIComponent(`${buildReceiptSummary(activeCompletedSale)}\nView and download receipt: ${payload.url}`);
      window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create receipt link.");
    } finally {
      setShareInFlight(false);
    }
  }

  function handleSendEmail() {
    if (!activeCompletedSale) return;
    const subject = encodeURIComponent(`Receipt ${activeCompletedSale.receiptNumber}`);
    const body = encodeURIComponent(buildReceiptSummary(activeCompletedSale));
    window.location.assign(`mailto:?subject=${subject}&body=${body}`);
  }

  function handleSendSms() {
    if (!activeCompletedSale) return;
    const body = encodeURIComponent(buildReceiptSummary(activeCompletedSale));
    window.location.assign(`sms:?body=${body}`);
  }

  async function handleReprintReceipt() {
    if (!activeCompletedSale || !canReprintReceipts) return;
    setReprintInFlight(true);
    try {
      const response = await fetch("/api/shop/receipts/reprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptNumber: activeCompletedSale.receiptNumber, saleId: null }),
      });
      if (!response.ok) throw new Error("Unable to log the receipt reprint");
      handlePrintReceipt();
      toast.success("Receipt reprint logged");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reprint receipt");
    } finally {
      setReprintInFlight(false);
    }
  }

  async function refreshMpesaPaymentStatus() {
    if (!mpesaPaymentId) return false;
    setManualConfirmationChecking(true);
    try {
      const response = await fetch(`/api/mpesa/payment/${encodeURIComponent(mpesaPaymentId)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to check M-Pesa payment status");
      const payment = payload.payment as {
        status: string;
        confirmed: boolean;
        expectedAmountMinor: number;
        receivedAmountMinor: number;
        internalReference: string;
        transactionId: string | null;
        resultDescription: string | null;
      };
      setMpesaStatus(payment.confirmed ? "Payment confirmed" : payment.resultDescription || payment.status);
      setMpesaReference(payment.transactionId || payment.internalReference);
      if (payment.confirmed) {
        setManualConfirmationConfirmed(true);
        setMpesaConfirmedAmountMinor(payment.receivedAmountMinor);
        setMpesaError(null);
        if (!splitPaymentEnabled) setAmountReceived(String(fromMinorUnits(payment.expectedAmountMinor)));
        else setMpesaAmount(String(fromMinorUnits(payment.expectedAmountMinor)));
        return true;
      }
      if (["FAILED", "CANCELLED", "TIMED_OUT", "UNDERPAID", "OVERPAID", "AMBIGUOUS", "UNMATCHED"].includes(payment.status)) {
        setMpesaError(payment.resultDescription || `M-Pesa payment ${payment.status.toLowerCase()}.`);
      }
      return false;
    } catch (error) {
      setMpesaError(error instanceof Error ? error.message : "Unable to check M-Pesa payment status");
      return false;
    } finally {
      setManualConfirmationChecking(false);
    }
  }

  async function startMpesaPayment(mode: "STK_PUSH" | "PAY_TO_TILL", expectedAmountMinor?: number) {
    if (!cart.length || mpesaInFlight || !registerSessionId) return;
    const amountMinor = typeof expectedAmountMinor === "number" ? expectedAmountMinor : checkoutTotalMinor;
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      toast.error("Enter a valid M-Pesa amount.");
      return;
    }
    setMpesaFlow(mode);
    setMpesaInFlight(true);
    setMpesaError(null);
    setManualConfirmationCandidates([]);
    setManualConfirmationSelection(null);
    setManualConfirmationChecking(false);
    setManualConfirmationConfirmed(false);
    setMpesaConfirmedAmountMinor(null);
    setMpesaStatus(mode === "STK_PUSH" ? "Sending STK Push" : "Preparing till payment");
    try {
      if (!mpesaEnabled) throw new Error("M-Pesa is not configured. Enable it in settings to use payment features.");
      const saleLocalReference = crypto.randomUUID();
      const response = await fetch("/api/mpesa/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registerSessionId,
          saleLocalReference,
          mode,
          expectedAmountMinor: amountMinor,
          customerPhone: mpesaPhone || null,
          clientReference: `pos:${saleLocalReference}`,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to start the M-Pesa payment request");
      setMpesaPaymentId(payload.payment.id);
      setMpesaSaleLocalReference(saleLocalReference);
      setMpesaReference(payload.payment.internalReference ?? null);
      setMpesaStatus(mode === "STK_PUSH" ? "STK Push sent — waiting for customer PIN" : "Waiting for payment at till");
      toast.success(mode === "STK_PUSH" ? "STK Push sent to the customer" : "Till payment is now waiting for confirmation");
    } catch (error) {
      setMpesaStatus("Payment request failed");
      setMpesaError(error instanceof Error ? error.message : "Unable to start M-Pesa payment");
      toast.error(error instanceof Error ? error.message : "Unable to start M-Pesa payment");
      setMpesaFlow(null);
    } finally {
      setMpesaInFlight(false);
    }
  }

  useEffect(() => {
    if (!mpesaPaymentId || !online) return;
    let active = true;
    async function pollMpesaPayment() {
      if (!active) return;
      await refreshMpesaPaymentStatus();
    }
    void pollMpesaPayment();
    const intervalId = window.setInterval(() => { void pollMpesaPayment(); }, 3_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  // The active payment ID is intentionally the polling key; state updates are handled by the status request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpesaPaymentId, online]);
  useEffect(() => {
    if (paymentMode === "MPESA" && !mpesaEnabled) {
      toast.info("M-Pesa is not configured. Enable it in settings to use payment features.");
    }
  }, [paymentMode, mpesaEnabled]);

  async function confirmManualMpesaPayment() {
    const confirmed = await refreshMpesaPaymentStatus();
    if (confirmed) {
      toast.success("M-Pesa payment confirmed. Complete the sale when ready.");
    } else {
      toast.info("The payment is still awaiting confirmation from M-Pesa.");
    }
  }
  return <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-black">Point of sale</h1><p className="text-sm text-slate-500">{online ? "Connected to the central system" : "Using the latest synchronized shop snapshot"}</p></div>{!online && <Badge tone="warning"><WifiOff className="mr-1 h-3.5 w-3.5" />Offline</Badge>}</div>
    {offlineActive ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Offline mode is active. Cash sales are stored locally and synced once the connection returns. Online-only payments such as M-Pesa and card are unavailable until you reconnect.</div> : null}
    {activeCompletedSale ? (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="payment-success-title">
        <Card className="max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto border-emerald-200 bg-emerald-50 p-5 shadow-2xl shadow-slate-950/30 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div id="payment-success-title" className="text-xl font-black text-emerald-800">Payment successful</div>
              <div className="mt-1 text-sm text-emerald-700">Receipt #{activeCompletedSale.receiptNumber}</div>
              <div className="mt-1 text-sm text-emerald-700">Total paid: {formatMoney(fromMinorUnits(activeCompletedSale.grandTotalMinor))}</div>
              <div className="mt-1 text-sm text-emerald-700">Payment method: {activeCompletedSale.paymentMethod}</div>
              <div className="mt-1 text-sm font-semibold text-emerald-700">{describeSaleLifecycleMessage(activeSaleLifecycleStatus, online)}</div>
            </div>
            <Button type="button" variant="primary" onClick={resetSaleState}>Start new sale</Button>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={handlePrintReceipt}>Print receipt</Button>
            <Button type="button" variant="secondary" onClick={() => void handleDownloadReceiptPdf()}>Download PDF</Button>
            <Button type="button" variant="secondary" onClick={handleSendSms}>Send SMS</Button>
            <Button type="button" variant="secondary" onClick={handleSendEmail}>Send email</Button>
            <Button type="button" variant="secondary" onClick={() => void handleShareWhatsapp()} isLoading={shareInFlight} disabled={shareInFlight} loadingText="Preparing link...">Share WhatsApp</Button>
            {canReprintReceipts ? <Button type="button" variant="ghost" onClick={() => void handleReprintReceipt()} isLoading={reprintInFlight} disabled={reprintInFlight} loadingText="Reprinting...">Reprint receipt</Button> : null}
          </div>
        </Card>
      </div>
    ) : null}
    {quotation ? (
      <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="quotation-title">
        <div className="relative flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-slate-100 shadow-2xl shadow-slate-950/30">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4"><div><h2 id="quotation-title" className="font-black text-slate-900">Quotation preview</h2><p className="text-xs text-slate-500">{quotation.quotationNumber}</p></div><button type="button" onClick={() => setQuotation(null)} aria-label="Close quotation preview" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"><X className="h-5 w-5" /></button></div>
          <iframe title="Quotation preview" srcDoc={buildQuotationHtml(quotation)} className="min-h-[520px] flex-1 border-0 bg-white" />
          <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-white p-4"><Button type="button" variant="primary" onClick={() => void downloadQuotationPdf(quotation)}>Download PDF</Button><Button type="button" variant="secondary" onClick={printQuotation}>Print quotation</Button><Button type="button" variant="secondary" onClick={() => void shareQuotationWhatsapp()} disabled={shareInFlight}>Share WhatsApp</Button><Button type="button" variant="secondary" onClick={() => void emailQuotation()} disabled={shareInFlight}>Share email</Button></div>
        </div>
      </div>
    ) : null}
    <div className="pos-layout">
      <section className="min-w-0">
        <Card className="mb-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <Input ref={searchInputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product or SKU" className="pl-10" />
            </div>
            {barcodeScanningEnabled ? (
              <Button type="button" variant={cameraActive ? "danger" : "secondary"} onClick={() => void startCameraScan()}>
                <Camera className="mr-2 h-4 w-4" />
                {cameraActive ? "Stop camera" : "Use camera"}
              </Button>
            ) : null}
          </div>
          {barcodeScanningEnabled ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex-1 min-w-[220px]">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Barcode scanner</label>
                <Input value={barcodeInput || hardwareScanBuffer} onChange={(e) => setBarcodeInput(e.target.value)} onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleBarcodeScan(barcodeInput || hardwareScanBuffer);
                    setBarcodeInput("");
                    setHardwareScanBuffer("");
                  }
                }} placeholder="Scan barcode, type code, or use camera" autoComplete="off" />
              </div>
              <Button type="button" variant="secondary" onClick={() => void handleBarcodeScan(barcodeInput)}>
                <ScanLine className="mr-2 h-4 w-4" />
                Add scanned item
              </Button>
            </div>
          ) : null}
          {cameraActive ? (
            <div className="mt-3 space-y-2">
              <div className="relative overflow-hidden rounded-2xl bg-black">
                <video ref={videoRef} className="h-64 w-full object-cover" autoPlay playsInline />
                {cameraScanning ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-20">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent" />
                      <p className="text-sm font-semibold text-white">Scanning for barcode...</p>
                      <div className="w-32 overflow-hidden rounded-full bg-gray-700">
                        <div className="h-1 bg-green-500 transition-all" style={{ width: `${cameraScanProgress}%` }} />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              {cameraError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {cameraError}
                </div>
              ) : null}
              <Button type="button" variant="secondary" onClick={() => void startCameraScan()} className="w-full">
                {cameraScanning ? "Stop scanning" : "Retry scan"}
              </Button>
            </div>
          ) : null}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${category === item ? "bg-[#173b89] text-white" : "bg-slate-100 text-slate-600"}`}>{item}</button>)}</div>
        </Card>
        {frequentProducts.length ? (
          <Card className="mb-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black">Frequently sold</p>
                <p className="text-xs text-slate-500">Quick add items that are often sold together.</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {frequentProducts.map((item) => (
                <button key={item.productId} onClick={() => item.inventoryEntry && add(item.inventoryEntry)} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300">
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.sku}</p>
                  </div>
                  <Badge tone="info">{item.quantity} sold</Badge>
                </button>
              ))}
            </div>
          </Card>
        ) : null}
        {filtered.length ? <div className="product-grid">{filtered.map((entry) => {
          const product = entry.product!;
          const status = getStockStatus(entry.projectedQuantity, entry.reorderLevel, entry.criticalLevel);
          const pricingOption = getPricingOption(entry);
          return <div key={`${entry.id}-${pricingOption.unitId ?? "default"}`} className="product-card surface rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-slate-100">
                {product.imageUrl ? (
                  <Image src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="56px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-blue-50 font-black text-blue-700">{product.name.slice(0, 2).toUpperCase()}</div>
                )}
              </div>
              <Badge tone={status === "IN_STOCK" ? "success" : status === "LOW_STOCK" ? "warning" : "danger"}>{entry.projectedQuantity} left</Badge>
            </div>
            <p className="mt-3 line-clamp-2 font-bold text-slate-900">{product.name}</p>
            <p className="mt-1 text-xs text-slate-500">{product.sku}</p>
            <p className="mt-3 text-lg font-black text-[#173b89]">
              {formatMoney(fromMinorUnits(pricingOption.sellingPriceMinor))}
              {pricingOption.unitSymbol ? ` / ${pricingOption.unitSymbol}` : ""}
            </p>
            {product.pricingOptions?.length ? (
              <div className="mt-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Unit</label>
                <select
                  value={selectedUnits[product.id] ?? pricingOption.unitId ?? ""}
                  onChange={(e) => setSelectedUnits((current) => ({ ...current, [product.id]: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {product.pricingOptions.map((option) => (
                    <option key={option.unitId ?? "default"} value={option.unitId ?? ""}>
                      {option.unitName ?? option.unitSymbol ?? "Unit"} — {formatMoney(fromMinorUnits(option.sellingPriceMinor))}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <button onClick={() => add(entry)} disabled={entry.projectedQuantity <= 0 || product.status !== "ACTIVE"} className="mt-4 w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Add</button>
          </div>;
        })}</div> : <Card className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><PackageX className="h-10 w-10 text-slate-300"/><p className="mt-3 font-bold">No products found</p><p className="mt-1 text-sm text-slate-500">Synchronize online or adjust your search.</p></Card>}
      </section>
      <Card className="cart-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-700" />
            <p className="font-black">Current sale</p>
          </div>
          <Badge>{cart.length} items</Badge>
        </div>
        <div className="border-b border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Checkout mode">
            <button type="button" onClick={() => setCheckoutMode("NORMAL")} className={`rounded-xl border px-3 py-2 text-left text-sm font-bold ${checkoutMode === "NORMAL" ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600"}`}>
              Normal sale
              <span className="mt-0.5 block text-[11px] font-normal">Offline-capable, no VAT or eTIMS submission</span>
            </button>
            <button type="button" onClick={() => setCheckoutMode("ETIMS")} disabled={!online || !etimsCheckout?.available} title={etimsCheckout?.reason ?? undefined} className={`rounded-xl border px-3 py-2 text-left text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${checkoutMode === "ETIMS" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600"}`}>
              eTIMS / VAT
              <span className="mt-0.5 block text-[11px] font-normal">Online fiscal checkout only</span>
            </button>
          </div>
          {!etimsCheckout?.available ? <p className="mt-2 text-xs text-amber-700">eTIMS is unavailable: {etimsCheckout?.reason ?? "This shop has not completed its certified eTIMS setup."}</p> : null}
        </div>
        <div className="cart-scroll flex flex-col p-4">
          {cart.length ? <div className="space-y-3">{cart.map((item) => <div key={`${item.productId}-${item.unitId ?? "default"}`} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{item.name}</p><p className="text-xs text-slate-500">{(item.unitName ?? item.unitSymbol) ? `${item.unitName ?? item.unitSymbol} • ` : ""}{formatMoney(fromMinorUnits(item.unitPriceMinor))} each</p></div><button onClick={() => setCart((current) => current.filter((line) => line.productId !== item.productId || line.unitId !== item.unitId))}><Trash2 className="h-4 w-4 text-red-500"/></button></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center gap-2"><button className="rounded-lg border p-1" onClick={() => changeQuantity(item.productId, item.unitId, -0.25)}><Minus className="h-4 w-4"/></button><Input type="number" inputMode="decimal" min="0.01" step="0.01" value={String(item.quantity)} onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isNaN(value)) return;
                setCartQuantity(item.productId, item.unitId, value);
              }} className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-sm" /><button className="rounded-lg border p-1" onClick={() => changeQuantity(item.productId, item.unitId, 0.25)}><Plus className="h-4 w-4"/></button></div><p className="font-black">{formatMoney(fromMinorUnits(Math.round(item.quantity * item.unitPriceMinor)))}</p></div></div>)}</div> : <div className="flex min-h-52 flex-col items-center justify-center text-center"><ShoppingCart className="h-10 w-10 text-slate-200"/><p className="mt-3 font-bold text-slate-700">Your cart is empty</p><p className="mt-1 text-sm text-slate-400">Select a product to begin.</p></div>}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><label className="mb-1 block text-xs font-bold text-slate-600">Convert an issued quotation</label><div className="flex gap-2"><Input value={quotationSearchNumber} onChange={(event) => setQuotationSearchNumber(event.target.value)} placeholder="Quotation number" /><Button type="button" variant="secondary" onClick={() => void convertQuotationToSale()} disabled={quotationSearchBusy}>{quotationSearchBusy ? "Loading..." : "Load quotation"}</Button></div></div>
          <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={createQuotation} disabled={!cart.length} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"><FileText className="h-4 w-4" />Generate quotation</button><button type="button" onClick={() => void saveQuotation()} disabled={!cart.length || shareInFlight} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">{shareInFlight ? "Saving..." : "Save quotation"}</button></div>
          <div className="mt-4 border-t border-slate-200 bg-slate-50 p-4 -mx-4">
            <div className="checkout-summary-grid">
              <div className="checkout-summary-card">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sale total</div>
                <div className="mt-1 text-2xl font-black text-slate-900">{formatMoney(fromMinorUnits(checkoutTotalMinor))}</div>
              </div>
              <div className="checkout-summary-card">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cash received</div>
                <div className="mt-1 text-lg font-black text-slate-900">{formatMoney(fromMinorUnits(receivedMinor))}</div>
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Change due</span><span className={`font-black ${changeDueMinor >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatMoney(fromMinorUnits(changeDueMinor))}</span></div>
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
              <label className="mb-1 block text-xs font-bold text-slate-600">Customer {paymentMode === "CREDIT" || (splitPaymentEnabled && splitSecondMethod === "CREDIT") ? "(required for credit)" : ""}</label>
              <select
                value={customerId || ""}
                onChange={async (e) => {
                  const id = e.target.value;
                  if (!id) {
                    setCustomerId(null);
                    setCustomerName("Walk-in customer");
                    setCustomerDetails(null);
                  } else {
                    const customer = allCustomers.find((c) => c.id === id);
                    if (customer) {
                      setCustomerId(id);
                      setCustomerName(customer.name);
                      try {
                        const res = await fetch(`/api/shop/customers/${id}`);
                        if (res.ok) setCustomerDetails(await res.json());
                      } catch {}
                    }
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">Walk-in customer</option>
                {allCustomers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? " • " + c.phone : ""}</option>
                ))}
              </select>

              {customerDetails ? (
                <div className="mt-2 text-sm text-slate-700">
                  <div>Outstanding: {formatMoney(fromMinorUnits(customerDetails.cachedOutstandingMinor ?? 0))}</div>
                  <div>Credit limit: {formatMoney(fromMinorUnits(customerDetails.creditLimit ?? 0))}</div>
                  <div>Available: {formatMoney(fromMinorUnits((customerDetails.creditLimit ?? 0) - (customerDetails.cachedOutstandingMinor ?? 0)))}</div>
                </div>
              ) : null}
              <label className="mt-3 mb-1 block text-xs font-bold text-slate-600">Discount</label>
              <Input type="number" min="0" step="0.01" disabled={checkoutMode === "ETIMS"} value={discountMinor / 100} onChange={(e) => setDiscountMinor(Math.round(Number(e.target.value || 0) * 100))} placeholder="0.00" />{checkoutMode === "ETIMS" ? <p className="mt-1 text-xs text-amber-700">Discounts remain unavailable until the certified eTIMS provider mapping is configured.</p> : null}
              <label className="mt-3 mb-1 block text-xs font-bold text-slate-600">Notes</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a note" />
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
              <label className="mb-1 block text-xs font-bold text-slate-600">Cash received</label>
              <Input type="number" min="0" step="0.01" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} placeholder="0.00" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setAmountReceived(String(checkoutTotalMinor / 100))}>Exact</Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setAmountReceived("500")}>KES 500</Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setAmountReceived("1000")}>KES 1,000</Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setAmountReceived("2000")}>KES 2,000</Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setAmountReceived("")}>Custom</Button>
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-600"><input className="h-4 w-4 rounded border-slate-300" type="checkbox" checked={splitPaymentEnabled} onChange={(e) => setSplitPaymentEnabled(e.target.checked)} />Allow split payment</label>
            {splitPaymentEnabled ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-3 mb-3">
                  <label className="mb-0 text-xs font-bold text-slate-600">Split target</label>
                  <div className="ml-2 inline-flex items-center gap-2">
                    <button type="button" onClick={() => setSplitSecondMethod("MPESA")} className={`rounded-full px-3 py-1 text-xs ${splitSecondMethod === "MPESA" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"}`}>M-Pesa</button>
                    <button type="button" onClick={() => setSplitSecondMethod("CREDIT")} className={`rounded-full px-3 py-1 text-xs ${splitSecondMethod === "CREDIT" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>Credit</button>
                  </div>
                </div>
                <label className="mb-1 block text-xs font-bold text-slate-600">{splitSecondMethod === "MPESA" ? "M-Pesa amount" : "Credit amount"}</label>
                <Input type="number" min="0" step="0.01" value={mpesaAmount} onChange={(e) => setMpesaAmount(e.target.value)} placeholder={splitSecondMethod === "MPESA" ? "Amount to collect via M-Pesa" : "Amount to put on customer credit"} />
                <p className="mt-2 text-xs text-slate-500">When split payment is enabled, you may collect part of the total via the selected method.</p>
              </div>
            ) : null}
            {splitPaymentEnabled ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {splitSecondMethod === "MPESA" ? (
                  <>
                    <Button type="button" variant="secondary" disabled={!mpesaEnabled || mpesaInFlight || !(Number.isFinite(Number(mpesaAmount || 0)) && Number(mpesaAmount) > 0)} onClick={() => { const amountMinor = Math.round((Number(mpesaAmount || 0) || 0) * 100); void startMpesaPayment("STK_PUSH", amountMinor); }}>Start M-Pesa (STK) for split amount</Button>
                    <Button type="button" variant="secondary" disabled={!mpesaEnabled || mpesaInFlight || !(Number.isFinite(Number(mpesaAmount || 0)) && Number(mpesaAmount) > 0) || !online} onClick={() => { const amountMinor = Math.round((Number(mpesaAmount || 0) || 0) * 100); void startMpesaPayment("PAY_TO_TILL", amountMinor); }}>Start M-Pesa (Till)</Button>
                  </>
                ) : (
                  // Split target is CREDIT — no external MPESA flow required
                  <>
                    <div />
                    <div />
                  </>
                )}
              </div>
            ) : null}
            <div className="mt-3 grid grid-cols-4 gap-2">
              <button onClick={() => { setPaymentMode("CASH"); setMpesaOverlayOpen(false); }} className={`w-full rounded-xl border p-2.5 text-xs font-bold ${paymentMode === "CASH" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}><Banknote className="mx-auto mb-1 h-5 w-5"/>Cash</button>
              <button onClick={() => { setPaymentMode("MPESA"); setMpesaOverlayOpen(true); setMpesaFlow(null); setMpesaStatus("Ready"); setMpesaError(null); setManualConfirmationCandidates([]); setManualConfirmationSelection(null); }} disabled={!online} className={`w-full rounded-xl border p-2.5 text-xs font-bold ${paymentMode === "MPESA" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600"} ${!online ? "opacity-50" : ""}`}><MdPhoneAndroid className="mx-auto mb-1 h-5 w-5"/>M-Pesa</button>
              <button onClick={() => { setPaymentMode("CARD"); setMpesaOverlayOpen(false); }} disabled={!online} className={`w-full rounded-xl border p-2.5 text-xs font-bold ${paymentMode === "CARD" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600"} ${!online ? "opacity-50" : ""}`}><CreditCard className="mx-auto mb-1 h-5 w-5"/>Card</button>
              <button onClick={() => { setPaymentMode("CREDIT"); setMpesaOverlayOpen(false); }} className={`w-full rounded-xl border p-2.5 text-xs font-bold ${paymentMode === "CREDIT" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600"}`}><PackageX className="mx-auto mb-1 h-5 w-5"/>Credit</button>
            </div>
            {!online ? <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Offline mode only allows cash. M-Pesa and card payments remain unavailable until the connection is restored.</div> : null}
            {(paymentMode === "CREDIT" || (splitPaymentEnabled && splitSecondMethod === "CREDIT")) ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <div className="text-[11px] font-black uppercase tracking-wide text-rose-700">Credit sale requires a customer</div>
                <div className="mt-1">Choose the customer in the Customer field above before completing this sale.</div>
              </div>
            ) : null}
            {splitPaymentEnabled ? (
              <Button onClick={() => void checkout()} isLoading={processing} disabled={!registerSessionId || !cart.length || processing || (checkoutMode === "ETIMS" && !etimsCheckout?.available) || (Math.round(Number(amountReceived || 0) * 100) + Math.round(Number(mpesaAmount || 0) * 100) < checkoutTotalMinor)} className="mt-3 w-full" size="lg" loadingText="Completing split sale...">Complete split payment{pendingCount ? ` • ${pendingCount} pending` : ""}</Button>
            ) : paymentMode === "CASH" ? (
              <Button onClick={() => void checkout()} isLoading={processing} disabled={!registerSessionId || !cart.length || processing || (checkoutMode === "ETIMS" && !etimsCheckout?.available)} className="mt-3 w-full" size="lg" loadingText="Completing sale..."><Banknote className="h-5 w-5"/>Complete cash sale{pendingCount ? ` • ${pendingCount} pending` : ""}</Button>
            ) : paymentMode === "CREDIT" ? (
              <Button onClick={() => void checkout()} isLoading={processing} disabled={!registerSessionId || !cart.length || processing || !customerId || (checkoutMode === "ETIMS" && !etimsCheckout?.available)} className="mt-3 w-full" size="lg" loadingText="Recording credit sale...">Complete credit sale{pendingCount ? ` • ${pendingCount} pending` : ""}</Button>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
    {mpesaOverlayOpen ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
        <div className="absolute inset-0 bg-slate-950/40" onClick={() => setMpesaOverlayOpen(false)} />
        <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-black text-slate-900">M-Pesa payment</p>
              <p className="mt-1 text-sm text-slate-500">Choose a payment mode and complete the transaction without pushing checkout down.</p>
            </div>
            <button type="button" onClick={() => setMpesaOverlayOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 transition hover:bg-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>

          {mpesaFlow === null ? (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <button ref={mpesaFlowButtonRef} type="button" onClick={() => setMpesaFlow("STK_PUSH")} className={`w-full rounded-3xl border px-5 py-4 text-left text-sm font-bold ${mpesaFlow === "STK_PUSH" ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600"}`}>
                  <div className="mb-3 text-xs uppercase tracking-wide text-slate-500">STK Push</div>
                  <div className="text-base font-semibold text-slate-900">Send payment request to customer</div>
                  <div className="mt-3 text-xs text-slate-500">{mpesaStkEnabled ? "Configured" : "Not configured"}</div>
                </button>
                <button type="button" onClick={() => setMpesaFlow("PAY_TO_TILL")} className={`w-full rounded-3xl border px-5 py-4 text-left text-sm font-bold ${mpesaFlow === "PAY_TO_TILL" ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600"}`}>
                  <div className="mb-3 text-xs uppercase tracking-wide text-slate-500">Pay to Till</div>
                  <div className="text-base font-semibold text-slate-900">Customer pays directly at till</div>
                  <div className="mt-3 text-xs text-slate-500">{mpesaPayToTillEnabled && mpesaTillNumber ? "Configured" : "Not configured"}</div>
                </button>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Choose your M-Pesa flow</p>
                <p className="mt-2 text-slate-500">Select STK Push to send the customer a payment prompt, or choose Pay to Till if the customer will pay directly at the till.</p>
              </div>
            </>
          ) : (
            <>
              <div className="mt-6 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">{mpesaFlow === "STK_PUSH" ? "STK Push" : "Pay to Till"}</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{mpesaFlow === "STK_PUSH" ? "Send a prompt to the customer" : "Customer pays directly at till"}</div>
                </div>
                <button type="button" onClick={() => { setMpesaFlow(null); setMpesaStatus("Ready"); setMpesaError(null); setManualConfirmationCandidates([]); setManualConfirmationSelection(null); }} className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Back
                </button>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Customer phone</label>
                <Input type="tel" inputMode="tel" value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value)} placeholder="Enter customer phone number" />
                <p className="mt-2 text-xs text-slate-500">This number is used for STK Push and Pay to Till confirmation.</p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <div className="font-semibold text-slate-900">Status</div>
                  <div className="mt-2">{mpesaStatus}</div>
                </div>
                {mpesaReference ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    <div className="font-semibold text-slate-900">Reference</div>
                    <div className="mt-2 break-all">{mpesaReference}</div>
                  </div>
                ) : null}
              </div>

              {mpesaError ? (
                <div className="mt-4 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {mpesaError}
                </div>
              ) : null}

              {mpesaFlow === "PAY_TO_TILL" && manualConfirmationCandidates.length ? (
                <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Recent payers</p>
                      <p className="text-xs text-slate-500">Select the customer to confirm the manual payment.</p>
                    </div>
                    <Button type="button" variant="secondary" disabled={!manualConfirmationSelection || mpesaInFlight || manualConfirmationChecking} onClick={() => void confirmManualMpesaPayment()}>
                      {manualConfirmationChecking ? "Confirming..." : "Confirm payment"}
                    </Button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {manualConfirmationCandidates.map((candidate) => (
                      <label key={`${candidate.phone}-${candidate.amountMinor}`} className="flex items-center justify-between rounded-2xl border border-slate-200 p-3">
                        <div className="flex items-center gap-3">
                          <input type="radio" name="manualConfirmationCandidate" value={`${candidate.phone}-${candidate.amountMinor}`} checked={manualConfirmationSelection === `${candidate.phone}-${candidate.amountMinor}`} onChange={() => setManualConfirmationSelection(`${candidate.phone}-${candidate.amountMinor}`)} className="h-4 w-4" />
                          <div>
                            <div className="font-semibold text-slate-900">{candidate.name}</div>
                            <div className="text-xs text-slate-500">{candidate.phone}</div>
                          </div>
                        </div>
                        <div className="text-sm font-black text-slate-900">{formatMoney(fromMinorUnits(candidate.amountMinor))}</div>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {mpesaPaymentId && !manualConfirmationConfirmed ? (
                <div className="mt-4 flex flex-col gap-3 rounded-3xl border border-sky-200 bg-sky-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-sky-900">Waiting for Safaricom confirmation. The sale cannot be completed until the payment is confirmed.</p>
                  <Button type="button" variant="secondary" disabled={manualConfirmationChecking} onClick={() => void confirmManualMpesaPayment()}>
                    {manualConfirmationChecking ? "Checking..." : "Refresh status"}
                  </Button>
                </div>
              ) : null}

              {manualConfirmationConfirmed ? (
                <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  M-Pesa payment confirmed. You can now complete the sale.
                </div>
              ) : null}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button type="button" disabled={mpesaInFlight || (Boolean(mpesaPaymentId) && !mpesaError) || (!mpesaPhone && mpesaFlow === "STK_PUSH")} onClick={() => { if (mpesaFlow) void startMpesaPayment(mpesaFlow); }} className="w-full sm:w-auto">
                  {mpesaFlow === "STK_PUSH" ? "Start STK Push" : "Start Pay to Till"}
                </Button>
                <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => { setMpesaFlow(null); setMpesaStatus("Ready"); setMpesaError(null); setManualConfirmationCandidates([]); setManualConfirmationSelection(null); }}>
                  Change payment type
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    ) : null}
    <CreditLimitOverrideModal
      isOpen={overrideModalOpen}
      customerId={pendingOverrideData?.customerId ?? ""}
      saleId={pendingOverrideData?.saleId ?? "pending"}
      amountMinor={pendingOverrideData?.totalCreditMinor ?? 0}
      creditLimitMinor={pendingOverrideData?.creditLimit ?? 0}
      onApprove={handleOverrideApprove}
      onCancel={() => {
        setOverrideModalOpen(false);
        setPendingOverrideData(null);
      }}
    />
    {unitModalOpen && unitModalEntry ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="unit-modal-title" aria-describedby="unit-modal-description">
        <div className="absolute inset-0 bg-black opacity-40" onClick={cancelUnitSelection} />
        <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <h3 id="unit-modal-title" className="text-lg font-bold">Pick unit for {unitModalEntry.product!.name}</h3>
          <p id="unit-modal-description" className="mt-1 text-sm text-slate-500">Select the unit to use for this sale line.</p>
          <div className="mt-4 space-y-3">
            {unitModalEntry.product!.pricingOptions?.map((opt, i) => (
              <label key={opt.unitId ?? "default"} className="flex items-center gap-3 rounded-lg border p-3 hover:border-slate-300 focus-within:border-blue-500">
                <input ref={i === 0 ? firstUnitRadioRef : undefined} type="radio" name="unitPick" checked={unitModalSelected === (opt.unitId ?? null)} onChange={() => setUnitModalSelected(opt.unitId ?? null)} />
                <div>
                  <div className="font-semibold">{opt.unitName ?? opt.unitSymbol ?? "Unit"}</div>
                  <div className="text-xs text-slate-500">{formatMoney(fromMinorUnits(opt.sellingPriceMinor))}{opt.unitSymbol ? ` / ${opt.unitSymbol}` : ''}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={cancelUnitSelection}>Cancel</Button>
            <Button type="button" onClick={() => confirmUnitSelection()}>Add with selected unit</Button>
          </div>
        </div>
      </div>
    ) : null}
  </div>;
}
