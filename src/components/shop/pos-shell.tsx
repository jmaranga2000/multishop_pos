"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Banknote, Camera, CreditCard, Minus, PackageX, Plus, ScanLine, Search, ShoppingCart, Trash2, WifiOff, X } from "lucide-react";
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
  available: number;
};

type FrequentProduct = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  inventoryEntry?: InventoryEntry;
};

type PaymentMode = "CASH" | "MPESA" | "CARD" | "BANK";

type MpesaFlow = "STK_PUSH" | "PAY_TO_TILL" | null;

type ReceiptSettings = {
  businessName?: string | null;
  shopName?: string | null;
  shopLocation?: string | null;
  shopContact?: string | null;
  taxInfo?: string | null;
  receiptFooter?: string | null;
  cashierName?: string | null;
  returnPolicy?: string | null;
  thankYouMessage?: string | null;
};

async function addReceiptQrCode(data: ThermalReceiptData) {
  const payload = [
    "MULTISHOP POS RECEIPT",
    `Receipt: ${data.receiptNumber}`,
    `Date: ${data.occurredAt}`,
    `Total (VAT inclusive): KES ${(data.grandTotalMinor / 100).toFixed(2)}`,
  ].join("\n");
  try {
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
}: {
  barcodeScanningEnabled?: boolean;
  mpesaEnabled?: boolean;
  mpesaStkEnabled?: boolean;
  mpesaPayToTillEnabled?: boolean;
  mpesaTillNumber?: string | null;
  shopName?: string;
  registerSessionId?: string | null;
  canReprintReceipts?: boolean;
}) {
  const { shopId, online, pendingCount } = useOffline();
  const offlineActive = !online;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<Record<string, string>>({});
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [unitModalEntry, setUnitModalEntry] = useState<InventoryEntry | null>(null);
  const [unitModalSelected, setUnitModalSelected] = useState<string | null>(null);
  const firstUnitRadioRef = useRef<HTMLInputElement | null>(null);
  const [processing, setProcessing] = useState(false);
  const [amountReceived, setAmountReceived] = useState("");
  const [customerName, setCustomerName] = useState("Walk-in customer");
  const [discountMinor, setDiscountMinor] = useState(0);
  const [notes, setNotes] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraScanning, setCameraScanning] = useState(false);
  const [cameraScanProgress, setCameraScanProgress] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hardwareScanBuffer, setHardwareScanBuffer] = useState("");
  const hardwareScanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [splitPaymentEnabled, setSplitPaymentEnabled] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const [mpesaOverlayOpen, setMpesaOverlayOpen] = useState(false);
  const [mpesaFlow, setMpesaFlow] = useState<MpesaFlow>(null);
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [mpesaStatus, setMpesaStatus] = useState("Ready");
  const [mpesaReference, setMpesaReference] = useState<string | null>(null);
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
  const receivedMinor = Math.round(Number(amountReceived || 0) * 100);
  const changeDueMinor = receivedMinor - totalMinor;

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
      const isInputField = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      const isBarcodeField = target === searchInputRef.current || (barcodeInput !== "" && !cameraActive);

      if (isInputField && !isBarcodeField) return;
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
    setMpesaError(null);
    setManualConfirmationCandidates([]);
    setManualConfirmationSelection(null);
    setManualConfirmationChecking(false);
    setCompletedSale(null);
    setCompletedSaleLocalId(null);
    setSaleLifecycleStatus("LOCAL_ONLY");
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  }

  function buildReceiptNumber(localId: string) {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `KSM-${stamp}-${localId.slice(0, 6).toUpperCase()}`;
  }

  async function checkout() {
    if (!registerSessionId) {
      toast.error("Open a register session before completing a sale.");
      return;
    }
    if (!cart.length || processing) return;
    if (!splitPaymentEnabled && receivedMinor < totalMinor) {
      toast.error("Amount received is lower than the sale total");
      return;
    }
    setProcessing(true);
    try {
      const sale = await createLocalSale({
        shopId,
        registerSessionId,
        paymentMethod: "CASH",
        amountPaidMinor: receivedMinor,
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
      const receiptNumber = sale.receiptNumber ?? buildReceiptNumber(sale.localId);
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
        paymentMethod: "Cash",
        amountPaidMinor: receivedMinor,
        changeDueMinor: Math.max(0, receivedMinor - totalMinor),
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
      setSplitPaymentEnabled(false);
      toast.success(online ? "Sale completed and submitted for synchronization" : "Offline sale saved", { description: `Receipt: ${receiptNumber}` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete sale");
    } finally {
      setProcessing(false);
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

  function handleShareWhatsapp() {
    if (!activeCompletedSale) return;
    const message = encodeURIComponent(buildReceiptSummary(activeCompletedSale));
    window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
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

  async function startMpesaPayment(mode: "STK_PUSH" | "PAY_TO_TILL") {
    if (!cart.length || mpesaInFlight) return;
    setMpesaFlow(mode);
    setMpesaInFlight(true);
    setMpesaError(null);
    setManualConfirmationCandidates([]);
    setManualConfirmationSelection(null);
    setManualConfirmationChecking(false);
    setManualConfirmationConfirmed(false);
    setMpesaStatus(mode === "STK_PUSH" ? "Sending request" : "Waiting for customer PIN");
    try {
      if (!mpesaEnabled) {
        throw new Error("M-Pesa is not configured. Enable it in settings to use payment features.");
      }
      const response = await fetch("/api/mpesa/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          mode,
          expectedAmountMinor: totalMinor,
          customerPhone: mpesaPhone || null,
          tillNumber: mpesaTillNumber || null,
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
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to create the M-Pesa payment request");
      setMpesaReference(payload.internalReference ?? null);
      setMpesaStatus(mode === "STK_PUSH" ? "Request sent" : "Waiting for Till payment");
      if (mode === "PAY_TO_TILL") {
        setMpesaStatus("Waiting for customer confirmation");
        void (async () => {
          if (!shopId) return;
          setManualConfirmationChecking(true);
          try {
            const response = await fetch(`/api/mpesa/manual-confirmation?shopId=${encodeURIComponent(shopId)}&expectedAmountMinor=${encodeURIComponent(totalMinor)}`);
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to load recent M-Pesa payers");
            setManualConfirmationCandidates(payload.candidates ?? []);
          } catch (error) {
            setMpesaError(error instanceof Error ? error.message : "Unable to load recent M-Pesa payers");
          } finally {
            setManualConfirmationChecking(false);
          }
        })();
      }
      toast.success(mode === "STK_PUSH" ? "STK Push request prepared" : "Till payment waiting started");
    } catch (error) {
        setMpesaStatus("Payment failed");
      setMpesaError(error instanceof Error ? error.message : "Unable to start M-Pesa payment");
      toast.error(error instanceof Error ? error.message : "Unable to start M-Pesa payment");
      setMpesaFlow(null);
    } finally {
      setMpesaInFlight(false);
    }
  }

  useEffect(() => {
    if (paymentMode !== "MPESA" || mpesaFlow !== "PAY_TO_TILL") return;

    async function pollManualConfirmationCandidatesLocal() {
      if (!shopId) return;
      setManualConfirmationChecking(true);
      try {
        const response = await fetch(`/api/mpesa/manual-confirmation?shopId=${encodeURIComponent(shopId)}&expectedAmountMinor=${encodeURIComponent(totalMinor)}`);
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to load recent M-Pesa payers");
        setManualConfirmationCandidates(payload.candidates ?? []);
        if ((payload.candidates ?? []).length) {
          setMpesaStatus("Reviewing recent customer names");
        }
      } catch (error) {
        setMpesaError(error instanceof Error ? error.message : "Unable to load recent M-Pesa payers");
      } finally {
        setManualConfirmationChecking(false);
      }
    }

    const intervalId = window.setInterval(() => {
      void pollManualConfirmationCandidatesLocal();
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [paymentMode, mpesaFlow, shopId, totalMinor]);

  useEffect(() => {
    if (paymentMode === "MPESA" && !mpesaEnabled) {
      toast.info("M-Pesa is not configured. Enable it in settings to use payment features.");
    }
  }, [paymentMode, mpesaEnabled]);

  async function confirmManualMpesaPayment() {
    if (!manualConfirmationSelection || !cart.length) return;
    setMpesaInFlight(true);
    setManualConfirmationChecking(true);
    try {
      const sale = await createLocalSale({
        shopId,
        registerSessionId,
        paymentMethod: "MPESA",
        amountPaidMinor: totalMinor,
        paymentReference: `MPESA:${manualConfirmationSelection}`,
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
      const receiptNumber = sale.receiptNumber ?? buildReceiptNumber(sale.localId);
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
        paymentMethod: "M-Pesa",
        amountPaidMinor: totalMinor,
        changeDueMinor: 0,
        paymentReference: sale.paymentReference ?? null,
        receiptFooter: receiptSettings?.receiptFooter ?? null,
        returnPolicy: receiptSettings?.returnPolicy ?? "Returns accepted within 7 days with original receipt.",
        thankYouMessage: receiptSettings?.thankYouMessage ?? "Thank you for shopping with us.",
      };
      setCompletedSale(await addReceiptQrCode(receiptData));
      setCompletedSaleLocalId(sale.localId);
      setSaleLifecycleStatus(online ? "PENDING_SYNC" : "LOCAL_ONLY");
      setCart([]);
      setAmountReceived(String(fromMinorUnits(totalMinor)));
      setSplitPaymentEnabled(false);
      setManualConfirmationConfirmed(true);
      setMpesaStatus("Payment confirmed");
      setMpesaReference(`Confirmed:${manualConfirmationSelection}`);
      toast.success("M-Pesa payment confirmed and sale completed");
    } catch (error) {
      setMpesaStatus("Confirmation failed");
      setMpesaError(error instanceof Error ? error.message : "Unable to confirm the M-Pesa payment");
      toast.error(error instanceof Error ? error.message : "Unable to confirm the M-Pesa payment");
    } finally {
      setMpesaInFlight(false);
      setManualConfirmationChecking(false);
    }
  }

  return <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-black">Point of sale</h1><p className="text-sm text-slate-500">{online ? "Connected to the central system" : "Using the latest synchronized shop snapshot"}</p></div>{!online && <Badge tone="warning"><WifiOff className="mr-1 h-3.5 w-3.5" />Offline</Badge>}</div>
    {offlineActive ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Offline mode is active. Cash sales are stored locally and synced once the connection returns. Online-only payments such as M-Pesa and card are unavailable until you reconnect.</div> : null}
    {activeCompletedSale ? (
      <Card className="mb-4 border-emerald-200 bg-emerald-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-black text-emerald-800">Payment successful</div>
            <div className="mt-1 text-sm text-emerald-700">Receipt #{activeCompletedSale.receiptNumber}</div>
            <div className="mt-1 text-sm text-emerald-700">Total paid: {formatMoney(fromMinorUnits(activeCompletedSale.grandTotalMinor))}</div>
            <div className="mt-1 text-sm text-emerald-700">Payment method: {activeCompletedSale.paymentMethod}</div>
            <div className="mt-1 text-sm font-semibold text-emerald-700">{describeSaleLifecycleMessage(activeSaleLifecycleStatus, online)}</div>
          </div>
          <Button type="button" variant="secondary" onClick={resetSaleState}>Start new sale</Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={handlePrintReceipt}>Print receipt</Button>
          <Button type="button" variant="secondary" onClick={() => void handleDownloadReceiptPdf()}>Download PDF</Button>
          <Button type="button" variant="secondary" onClick={handleSendSms}>Send SMS</Button>
          <Button type="button" variant="secondary" onClick={handleSendEmail}>Send email</Button>
          <Button type="button" variant="secondary" onClick={handleShareWhatsapp}>Share WhatsApp</Button>
          {canReprintReceipts ? <Button type="button" variant="ghost" onClick={() => void handleReprintReceipt()} isLoading={reprintInFlight} disabled={reprintInFlight} loadingText="Reprinting...">Reprint receipt</Button> : null}
        </div>
      </Card>
    ) : null}
    <div className="pos-layout">
      <section className="min-w-0">
        <Card className="mb-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <Input ref={searchInputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product, SKU or scan barcode" className="pl-10" />
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
        <div className="cart-scroll flex flex-col p-4">
          {cart.length ? <div className="space-y-3">{cart.map((item) => <div key={`${item.productId}-${item.unitId ?? "default"}`} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{item.name}</p><p className="text-xs text-slate-500">{(item.unitName ?? item.unitSymbol) ? `${item.unitName ?? item.unitSymbol} • ` : ""}{formatMoney(fromMinorUnits(item.unitPriceMinor))} each</p></div><button onClick={() => setCart((current) => current.filter((line) => line.productId !== item.productId || line.unitId !== item.unitId))}><Trash2 className="h-4 w-4 text-red-500"/></button></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center gap-2"><button className="rounded-lg border p-1" onClick={() => changeQuantity(item.productId, item.unitId, -0.25)}><Minus className="h-4 w-4"/></button><Input type="number" inputMode="decimal" min="0.01" step="0.01" value={String(item.quantity)} onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isNaN(value)) return;
                setCartQuantity(item.productId, item.unitId, value);
              }} className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-sm" /><button className="rounded-lg border p-1" onClick={() => changeQuantity(item.productId, item.unitId, 0.25)}><Plus className="h-4 w-4"/></button></div><p className="font-black">{formatMoney(fromMinorUnits(Math.round(item.quantity * item.unitPriceMinor)))}</p></div></div>)}</div> : <div className="flex min-h-52 flex-col items-center justify-center text-center"><ShoppingCart className="h-10 w-10 text-slate-200"/><p className="mt-3 font-bold text-slate-700">Your cart is empty</p><p className="mt-1 text-sm text-slate-400">Select a product to begin.</p></div>}
          <div className="mt-4 border-t border-slate-200 bg-slate-50 p-4 -mx-4">
            <div className="checkout-summary-grid">
              <div className="checkout-summary-card">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sale total</div>
                <div className="mt-1 text-2xl font-black text-slate-900">{formatMoney(fromMinorUnits(totalMinor))}</div>
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
              <label className="mb-1 block text-xs font-bold text-slate-600">Customer</label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in customer" />
              <label className="mt-3 mb-1 block text-xs font-bold text-slate-600">Discount</label>
              <Input type="number" min="0" step="0.01" value={discountMinor / 100} onChange={(e) => setDiscountMinor(Math.round(Number(e.target.value || 0) * 100))} placeholder="0.00" />
              <label className="mt-3 mb-1 block text-xs font-bold text-slate-600">Notes</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a note" />
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
              <label className="mb-1 block text-xs font-bold text-slate-600">Cash received</label>
              <Input type="number" min="0" step="0.01" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} placeholder="0.00" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setAmountReceived(String(totalMinor / 100))}>Exact</Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setAmountReceived("500")}>KES 500</Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setAmountReceived("1000")}>KES 1,000</Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setAmountReceived("2000")}>KES 2,000</Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setAmountReceived("")}>Custom</Button>
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-600"><input className="h-4 w-4 rounded border-slate-300" type="checkbox" checked={splitPaymentEnabled} onChange={(e) => setSplitPaymentEnabled(e.target.checked)} />Allow split payment</label>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={() => { setPaymentMode("CASH"); setMpesaOverlayOpen(false); }} className={`w-full rounded-xl border p-2.5 text-xs font-bold ${paymentMode === "CASH" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}><Banknote className="mx-auto mb-1 h-5 w-5"/>Cash</button>
              <button onClick={() => { setPaymentMode("MPESA"); setMpesaOverlayOpen(true); }} disabled={!online} className={`w-full rounded-xl border p-2.5 text-xs font-bold ${paymentMode === "MPESA" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600"} ${!online ? "opacity-50" : ""}`}><MdPhoneAndroid className="mx-auto mb-1 h-5 w-5"/>M-Pesa</button>
              <button onClick={() => { setPaymentMode("CARD"); setMpesaOverlayOpen(false); }} disabled={!online} className={`w-full rounded-xl border p-2.5 text-xs font-bold ${paymentMode === "CARD" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600"} ${!online ? "opacity-50" : ""}`}><CreditCard className="mx-auto mb-1 h-5 w-5"/>Card</button>
            </div>
            {!online ? <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Offline mode only allows cash. M-Pesa and card payments remain unavailable until the connection is restored.</div> : null}
            {paymentMode === "CASH" ? <Button onClick={() => void checkout()} isLoading={processing} disabled={!registerSessionId || !cart.length || processing} className="mt-3 w-full" size="lg" loadingText="Completing sale..."><Banknote className="h-5 w-5"/>Complete cash sale{pendingCount ? ` • ${pendingCount} pending` : ""}</Button> : null}
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

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <button type="button" onClick={() => startMpesaPayment("STK_PUSH")} className={`w-full rounded-3xl border px-5 py-4 text-left text-sm font-bold ${mpesaFlow === "STK_PUSH" ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600"}`}>
              <div className="mb-3 text-xs uppercase tracking-wide text-slate-500">STK Push</div>
              <div className="text-base font-semibold text-slate-900">Send payment request to customer</div>
              <div className="mt-3 text-xs text-slate-500">{mpesaStkEnabled ? "Configured" : "Not configured"}</div>
            </button>
            <button type="button" onClick={() => startMpesaPayment("PAY_TO_TILL")} className={`w-full rounded-3xl border px-5 py-4 text-left text-sm font-bold ${mpesaFlow === "PAY_TO_TILL" ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600"}`}>
              <div className="mb-3 text-xs uppercase tracking-wide text-slate-500">Pay to Till</div>
              <div className="text-base font-semibold text-slate-900">Customer pays directly at till</div>
              <div className="mt-3 text-xs text-slate-500">{mpesaPayToTillEnabled && mpesaTillNumber ? "Configured" : "Not configured"}</div>
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

          {manualConfirmationConfirmed ? (
            <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Manual M-Pesa payment confirmed.
            </div>
          ) : null}
        </div>
      </div>
    ) : null}
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
