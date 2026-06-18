"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { CreditCard, Package, Plus, ShoppingCart, UserRound } from "lucide-react";
import ConfirmModal from "@/app/components/Modal/ConfirmModal";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { FormField } from "@/app/components/ui-ext/FormField";
import { PaymentMethodPicker } from "@/app/dashboard/invoices/components/PaymentMethodPicker";
import { SaleFormSection } from "@/app/dashboard/invoices/components/SaleFormSection";
import { SalePageLayout } from "@/app/dashboard/invoices/components/SalePageLayout";
import { SegmentPicker } from "@/app/dashboard/invoices/components/SegmentPicker";
import { useAuth } from "@/app/providers/AuthProvider";
import { useOutletAccess } from "@/app/providers/OutletAccessProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { getCustomerTypes } from "@/handlers/customerType";
import { createCustomer, getCustomers, type Customer } from "@/handlers/customer";
import { getDualPricings } from "@/handlers/dualPricing";
import { getUnitPrice } from "@/lib/dualPricingLookup";
import {
  formatNameWithOutlet,
  outletLabelFromProduct,
} from "@/lib/productDisplay";
import { getMainOutletId, getOutlets, type Outlet } from "@/handlers/outlet";
import { getProducts, type Product } from "@/handlers/product";
import { getProductTypes } from "@/handlers/productType";
import { createSale, type SaleItemPayload } from "@/handlers/sale";
import {
  allocateCartDiscount,
  cartSubtotal,
  formatSaleAmount,
  lineSubtotal,
} from "@/lib/saleCalculations";
import {
  DEFAULT_SALE_PAYMENT_METHOD,
  paymentMethodLabel,
  type SalePaymentMethod,
} from "@/lib/salePaymentMethods";
import { validateProcessedSaleCreate } from "@/schema/sale";
import { readOutletScopeFromSearch } from "@/lib/outletScope";
import PosCustomerNameCombobox from "./PosCustomerNameCombobox";
import { findMatchingCustomer } from "./findMatchingCustomer";
import "../components/sale-entry.scss";

type LinePricingMode = "weight" | "amount";

type PosCheckoutPayload = {
  saleItems: SaleItemPayload[];
  customerCreate: {
    name: string;
    contact: string;
    outletId: string;
    customerTypeId: string;
  } | null;
};

const PRODUCTS_QUERY_KEY = ["products"];
const PRODUCT_TYPES_QUERY_KEY = ["productTypes"];
const OUTLETS_QUERY_KEY = ["outlets"];
const DUAL_PRICING_QUERY_KEY = ["dualPricing"];
const CUSTOMER_TYPES_QUERY_KEY = ["customerTypes"];
const CUSTOMERS_QUERY_KEY = ["customers"];
const SALES_QUERY_KEY = ["sales"];
const DASHBOARD_SALES_QUERY_KEY = ["dashboardSales"];

type LineItem = {
  productId: string;
  productName: string;
  /** Sold amount in kg (processed inventory is tracked by weight) */
  weight: number;
  unitPrice: number;
  customerTypeId: string;
  typeName: string;
  stockAvailable: number;
  /** When set, overrides weight × unitPrice for this line */
  amountOverride?: number | null;
};

/** Parsed numeric or null (not 0 — zero is valid stock). */
function parseKgField(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Available kg for processed POS: prefer weight-style fields (coerced), then quantity.
 * Avoids treating `quantity: 0` as stock when the API only populated weight (possibly as string or alternate key).
 */
function getProcessedProductAvailableKg(product: Product | undefined): number {
  if (!product) return 0;
  const r = product as Record<string, unknown>;
  return (
    parseKgField(product.weight) ??
    parseKgField(r.weight) ??
    parseKgField(r.stockWeight) ??
    parseKgField(r.availableWeight) ??
    parseKgField(r.currentWeight) ??
    parseKgField(r.totalWeight) ??
    parseKgField(r.outputWeight) ??
    parseKgField(r.itemQuantityOrWeight) ??
    parseKgField(product.quantity) ??
    parseKgField(r.quantity) ??
    0
  );
}

function formatProcessedProductOptionLabel(
  product: Product,
  outletsList: Outlet[],
  availableKg: number
): string {
  const withOutlet = formatNameWithOutlet(
    product.name,
    outletLabelFromProduct(product, outletsList)
  );
  const kgText =
    Number.isInteger(availableKg) || availableKg % 1 === 0
      ? String(availableKg)
      : availableKg.toFixed(2);
  return `${withOutlet} — ${kgText} kg`;
}

/** Match API rows that expose outlet on `outletId` and/or nested `outlet.id`. */
function productOutletIdForFilter(p: Product): string {
  const nested =
    typeof p.outlet === "object" && p.outlet && "id" in p.outlet
      ? String((p.outlet as { id?: string }).id ?? "").trim()
      : "";
  return String(p.outletId ?? nested).trim();
}

export default function PointOfSalePage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { showToast } = useToast();
  const { userOutletId } = useAuth();
  const { accessTier } = useOutletAccess();
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [outletId, setOutletId] = useState("");
  const [productId, setProductId] = useState("");
  const [lineTypeId, setLineTypeId] = useState("");
  const [lineWeightInput, setLineWeightInput] = useState("");
  const [lineAmountInput, setLineAmountInput] = useState("");
  const [linePricingMode, setLinePricingMode] = useState<LinePricingMode>("weight");
  const [cartDiscountInput, setCartDiscountInput] = useState("0");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorShowPricelistLink, setErrorShowPricelistLink] = useState(false);
  const [checkoutConfirmOpen, setCheckoutConfirmOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>(
    DEFAULT_SALE_PAYMENT_METHOD
  );
  const productSelectRef = useRef<HTMLSelectElement>(null);

  const { data: products = [] } = useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: async () => {
      const result = await getProducts();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const { data: productTypes = [] } = useQuery({
    queryKey: PRODUCT_TYPES_QUERY_KEY,
    queryFn: async () => {
      const result = await getProductTypes();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: outlets = [] } = useQuery({
    queryKey: OUTLETS_QUERY_KEY,
    queryFn: async () => {
      const result = await getOutlets();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const mainOutletId = useMemo(() => getMainOutletId(outlets), [outlets]);

  const outletsForSelect = useMemo(() => {
    if (userOutletId == null) return outlets;
    if (mainOutletId != null && userOutletId === mainOutletId) {
      return outlets;
    }
    return outlets.filter((o) => o.id === userOutletId);
  }, [outlets, userOutletId, mainOutletId]);

  useEffect(() => {
    if (userOutletId && outlets.length > 0 && !outletId) {
      const allowed = outlets.some((o) => o.id === userOutletId);
      if (allowed) setOutletId(userOutletId);
    }
  }, [userOutletId, outlets, outletId]);

  const outletScopeFromUrl = useMemo(() => readOutletScopeFromSearch(search), [search]);

  /** Highland / sidebar links include `?outletId=` for the selected sub-outlet. */
  useEffect(() => {
    if (!outletScopeFromUrl || outlets.length === 0) return;
    const allowed = outlets.some((o) => o.id === outletScopeFromUrl);
    if (!allowed) return;
    setOutletId((prev) => (prev === outletScopeFromUrl ? prev : outletScopeFromUrl));
  }, [outletScopeFromUrl, outlets]);

  const { data: dualPricings = [] } = useQuery({
    queryKey: DUAL_PRICING_QUERY_KEY,
    queryFn: async () => {
      const result = await getDualPricings();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const { data: customerTypes = [] } = useQuery({
    queryKey: CUSTOMER_TYPES_QUERY_KEY,
    queryFn: async () => {
      const result = await getCustomerTypes();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const { data: allCustomers = [] } = useQuery({
    queryKey: CUSTOMERS_QUERY_KEY,
    queryFn: async () => {
      const result = await getCustomers();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const applyRegisteredCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerContact(customer.contact);
    if (customer.customerTypeId) {
      setLineTypeId(customer.customerTypeId);
    }
  };

  const handleCustomerNameChange = (value: string) => {
    setSelectedCustomerId("");
    setCustomerName(value);
  };

  const handleCustomerContactChange = (value: string) => {
    setSelectedCustomerId("");
    setCustomerContact(value);
  };

  const processedProducts = useMemo(() => {
    return products.filter((p: Product) => {
      const ptName =
        (p as Product & { productType?: { name?: string } })?.productType?.name ??
        productTypes.find((pt: { id: string; name: string }) => pt.id === p.productTypeId)?.name ??
        "";
      return ptName.toLowerCase() === "processed";
    });
  }, [products, productTypes]);

  /**
   * Processed-sale product list is always scoped to the chosen outlet (dropdown) or deep-linked
   * `?outletId=`. Until an outlet is known, the product dropdown stays empty so main-outlet users
   * do not see every plant’s inventory at once.
   */
  const effectiveOutletForProductList = outletId.trim() || outletScopeFromUrl;

  const processedProductsForDropdown = useMemo(() => {
    const scopeId = String(effectiveOutletForProductList ?? "").trim();
    if (!scopeId) return [];
    return processedProducts.filter(
      (p) => productOutletIdForFilter(p) === scopeId
    );
  }, [processedProducts, effectiveOutletForProductList]);

  useEffect(() => {
    if (!productId) return;
    if (!processedProductsForDropdown.some((p) => p.id === productId)) {
      setProductId("");
    }
  }, [processedProductsForDropdown, productId]);

  const clearLineForm = () => {
    setLineWeightInput("");
    setLineAmountInput("");
    setLinePricingMode("weight");
    setProductId("");
    setEditingLineIndex(null);
  };

  const previewLineUnitPrice = useMemo(() => {
    if (!productId || !outletId || !lineTypeId) return null;
    const selectedType = customerTypes.find((ct) => ct.id === lineTypeId);
    const isWholesale = selectedType?.name?.toLowerCase().includes("wholesale") ?? false;
    const price = getUnitPrice(dualPricings, productId, outletId, isWholesale);
    return Number.isFinite(price) && price > 0 ? price : null;
  }, [productId, outletId, lineTypeId, customerTypes, dualPricings]);

  const previewCalculatedLineAmount = useMemo(() => {
    const weight = Number(lineWeightInput);
    if (!previewLineUnitPrice || !Number.isFinite(weight) || weight <= 0) return null;
    return previewLineUnitPrice * weight;
  }, [previewLineUnitPrice, lineWeightInput]);

  const handleLinePricingModeChange = (mode: LinePricingMode) => {
    setLinePricingMode(mode);
    if (mode === "weight") {
      setLineAmountInput("");
    } else {
      setLineWeightInput("");
    }
  };

  const startEditLine = (index: number) => {
    const line = lineItems[index];
    if (!line) return;
    setEditingLineIndex(index);
    setProductId(line.productId);
    setLineTypeId(line.customerTypeId);
    const hasOverride = line.amountOverride != null && line.amountOverride > 0;
    if (hasOverride) {
      setLinePricingMode("amount");
      setLineWeightInput("");
      setLineAmountInput(formatSaleAmount(line.amountOverride as number));
    } else {
      setLinePricingMode("weight");
      setLineWeightInput(String(line.weight));
      setLineAmountInput("");
    }
    setError(null);
    setErrorShowPricelistLink(false);
    productSelectRef.current?.focus();
  };

  const cancelEditLine = () => {
    clearLineForm();
    setError(null);
    setErrorShowPricelistLink(false);
  };

  const handleSaveLine = () => {
    if (!productId || !outletId) {
      setErrorShowPricelistLink(false);
      setError(t("Select product and outlet."));
      return;
    }
    if (!lineTypeId) {
      setErrorShowPricelistLink(false);
      setError(t("Select type (Retail/Wholesale) for this product."));
      return;
    }
    const product = products.find((p: Product) => p.id === productId);
    const stockAvailable = getProcessedProductAvailableKg(product);
    const editingLine =
      editingLineIndex !== null ? lineItems[editingLineIndex] : undefined;
    const stockForLine =
      editingLine?.productId === productId
        ? stockAvailable + editingLine.weight
        : stockAvailable;
    const selectedType = customerTypes.find((ct) => ct.id === lineTypeId);
    const isWholesale = selectedType?.name?.toLowerCase().includes("wholesale") ?? false;
    const unitPrice = getUnitPrice(
      dualPricings,
      productId,
      outletId,
      isWholesale
    );
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      setError(
        t(
          "No pricelist entry for this product at the selected outlet, or the price for this customer type is zero. Add or update prices under Pricelist before selling."
        )
      );
      setErrorShowPricelistLink(true);
      return;
    }
    setErrorShowPricelistLink(false);

    let selectedWeight: number;
    let amountOverride: number | null = null;

    if (linePricingMode === "weight") {
      selectedWeight = Number(lineWeightInput);
      if (!Number.isFinite(selectedWeight) || selectedWeight <= 0) {
        setErrorShowPricelistLink(false);
        setError(t("Weight must be greater than 0."));
        return;
      }
    } else {
      const parsedLineAmount = Number(lineAmountInput);
      if (!Number.isFinite(parsedLineAmount) || parsedLineAmount <= 0) {
        setError(t("Line amount must be greater than 0."));
        return;
      }
      selectedWeight = Math.round((parsedLineAmount / unitPrice) * 1000) / 1000;
      if (!Number.isFinite(selectedWeight) || selectedWeight <= 0) {
        setError(t("Line amount is too low for this product's unit price."));
        return;
      }
      amountOverride = parsedLineAmount;
    }

    if (selectedWeight > stockForLine) {
      setErrorShowPricelistLink(false);
      setError(
        t(`Insufficient stock for product ${product?.name ?? "-"} (available: ${stockForLine}).`)
      );
      return;
    }

    const nextLine: LineItem = {
      productId,
      productName: product?.name ?? "-",
      weight: selectedWeight,
      unitPrice,
      customerTypeId: lineTypeId,
      typeName: selectedType?.name ?? "-",
      stockAvailable,
      amountOverride,
    };
    if (editingLineIndex !== null) {
      setLineItems((prev) =>
        prev.map((item, i) => (i === editingLineIndex ? nextLine : item))
      );
    } else {
      setLineItems((prev) => [...prev, nextLine]);
    }
    clearLineForm();
    setError(null);
    setErrorShowPricelistLink(false);
  };

  const removeLine = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
    if (editingLineIndex === index) {
      clearLineForm();
    } else if (editingLineIndex !== null && index < editingLineIndex) {
      setEditingLineIndex(editingLineIndex - 1);
    }
  };

  const subtotal = useMemo(() => cartSubtotal(lineItems), [lineItems]);

  const parsedCartDiscount = useMemo(() => {
    const value = Number(cartDiscountInput);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }, [cartDiscountInput]);

  const totalDue = useMemo(
    () => Math.max(0, Math.round((subtotal - parsedCartDiscount) * 100) / 100),
    [subtotal, parsedCartDiscount]
  );

  const buildSaleItems = (): SaleItemPayload[] | null => {
    const trimmedName = customerName.trim();
    const trimmedContact = customerContact.trim();
    const discounts = allocateCartDiscount(lineItems, parsedCartDiscount);
    const saleItems: SaleItemPayload[] = lineItems.map((item, index) => {
      const sub = lineSubtotal(item);
      const lineDiscount = discounts[index] ?? 0;
      return {
        name: trimmedName,
        contact: trimmedContact,
        customerTypeId: item.customerTypeId,
        productId: item.productId,
        outletId,
        weight: item.weight,
        amount: sub,
        discountAmount: lineDiscount,
        paymentMethod,
      };
    });
    const validation = validateProcessedSaleCreate(saleItems);
    if (!validation.ok) return null;
    return saleItems;
  };

  const checkoutConfirmMessage = useMemo(() => {
    const paymentLabel = paymentMethodLabel(paymentMethod);
    const discountLine =
      parsedCartDiscount > 0
        ? t("Discount: Rs.{{amount}}").replace("{{amount}}", formatSaleAmount(parsedCartDiscount))
        : "";
    return [
      t("Subtotal: Rs.{{amount}}").replace("{{amount}}", formatSaleAmount(subtotal)),
      discountLine,
      t("Total due: Rs.{{amount}}").replace("{{amount}}", formatSaleAmount(totalDue)),
      t("Payment: {{method}}").replace("{{method}}", paymentLabel),
      t("Complete this sale and add it to transactions?"),
    ]
      .filter(Boolean)
      .join("\n");
  }, [subtotal, parsedCartDiscount, totalDue, paymentMethod, t]);

  const createSaleMutation = useMutation({
    mutationFn: async (payload: PosCheckoutPayload) => {
      const saleResult = await createSale(payload.saleItems);
      if (!saleResult.ok) {
        return {
          saleOk: false as const,
          error: saleResult.error,
          status: saleResult.status,
        };
      }

      if (!payload.customerCreate) {
        return { saleOk: true as const, customerCreated: false as const };
      }

      const customerResult = await createCustomer(payload.customerCreate);
      if (!customerResult.ok) {
        return {
          saleOk: true as const,
          customerCreated: false as const,
          customerCreateError: customerResult.error,
        };
      }

      return { saleOk: true as const, customerCreated: true as const };
    },
    onSuccess: (result) => {
      if (!result.saleOk) {
        if (result.status === 401) navigate("/login");
        else {
          setError(result.error);
          showToast(result.error, "error");
        }
        return;
      }

      if ("customerCreateError" in result && result.customerCreateError) {
        showToast(
          t("Sale recorded, but the customer could not be saved: {{message}}").replace(
            "{{message}}",
            result.customerCreateError
          ),
          "error"
        );
      }

      setLineItems([]);
      setCustomerName("");
      setCustomerContact("");
      setSelectedCustomerId("");
      setPaymentMethod(DEFAULT_SALE_PAYMENT_METHOD);
      setCartDiscountInput("0");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: SALES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_SALES_QUERY_KEY });
      if (result.customerCreated) {
        void queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY });
      }
      navigate("/dashboard/invoices/transaction");
    },
    onError: () => {
      const message = t("Something went wrong. Please try again.");
      setError(message);
      showToast(message, "error");
    },
  });

  const doCheckout = () => {
    const invalidPrice = lineItems.some(
      (item) => !Number.isFinite(item.unitPrice) || item.unitPrice <= 0
    );
    if (invalidPrice) {
      setCheckoutConfirmOpen(false);
      setError(
        t(
          "Every line must have a positive pricelist price for this outlet. Remove invalid lines or add prices under Pricelist."
        )
      );
      setErrorShowPricelistLink(true);
      return;
    }
    if (parsedCartDiscount > subtotal) {
      setCheckoutConfirmOpen(false);
      setError(t("Discount cannot exceed the subtotal."));
      setErrorShowPricelistLink(false);
      return;
    }
    const discounts = allocateCartDiscount(lineItems, parsedCartDiscount);
    const hasZeroNetLine = lineItems.some((item, index) => {
      const sub = lineSubtotal(item);
      const lineDiscount = discounts[index] ?? 0;
      return sub - lineDiscount <= 0;
    });
    if (hasZeroNetLine) {
      setCheckoutConfirmOpen(false);
      setError(t("Each line must have a positive amount after discount."));
      setErrorShowPricelistLink(false);
      return;
    }
    const saleItems = buildSaleItems();
    if (!saleItems) {
      setCheckoutConfirmOpen(false);
      setError(t("Invalid sale data. Check line amounts and try again."));
      setErrorShowPricelistLink(false);
      return;
    }
    setErrorShowPricelistLink(false);
    const trimmedName = customerName.trim();
    const trimmedContact = customerContact.trim();

    const alreadyKnown =
      Boolean(selectedCustomerId) ||
      findMatchingCustomer(allCustomers, {
        name: trimmedName,
        contact: trimmedContact,
        outletId,
      }) != null;

    const customerCreate =
      alreadyKnown || lineItems.length === 0
        ? null
        : {
            name: trimmedName,
            contact: trimmedContact,
            outletId,
            customerTypeId: lineItems[0].customerTypeId,
          };

    createSaleMutation.mutate({ saleItems, customerCreate });
    setCheckoutConfirmOpen(false);
  };

  const handleCheckout = () => {
    if (!outletId || lineItems.length === 0) {
      setError(t("Add at least one product and select an outlet."));
      setErrorShowPricelistLink(false);
      return;
    }
    if (!customerName.trim()) {
      setError(t("Enter customer details."));
      setErrorShowPricelistLink(false);
      return;
    }
    if (!customerContact.trim()) {
      setError(t("Enter customer contact."));
      setErrorShowPricelistLink(false);
      return;
    }
    const invalidPrice = lineItems.some(
      (item) => !Number.isFinite(item.unitPrice) || item.unitPrice <= 0
    );
    if (invalidPrice) {
      setError(
        t(
          "Every line must have a positive pricelist price for this outlet. Remove invalid lines or add prices under Pricelist."
        )
      );
      setErrorShowPricelistLink(true);
      return;
    }
    if (parsedCartDiscount > subtotal) {
      setError(t("Discount cannot exceed the subtotal."));
      setErrorShowPricelistLink(false);
      return;
    }
    setError(null);
    setErrorShowPricelistLink(false);
    setCheckoutConfirmOpen(true);
  };

  const linePricingOptions = useMemo(
    () => [
      { value: "weight" as const, label: t("Weight") },
      { value: "amount" as const, label: t("Fixed amount") },
    ],
    [t],
  );

  return (
    <SalePageLayout
      sectionLabel={t("Sales & Billing")}
      pageTitle={t("Point of Sale")}
      subtitle={t("Scan barcode or search products")}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-start">
        <Card className="min-w-0 shadow-sm">
          <CardHeader className="border-b pb-5">
            <CardTitle>{t("Current Sale")}</CardTitle>
            <CardDescription>
              {t(
                "Choose outlet and payment, add processed product lines, then checkout to record the sale.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <SaleFormSection
              divided={false}
              id="pos-section-customer"
              title={t("Customer & outlet")}
              icon={<UserRound className="size-4" />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="pos-customer-name" label={t("Customer Details")}>
                  <PosCustomerNameCombobox
                    customers={allCustomers}
                    outletId={outletId}
                    value={customerName}
                    onChange={handleCustomerNameChange}
                    onSelectCustomer={applyRegisteredCustomer}
                    t={t}
                  />
                </FormField>
                <FormField id="pos-customer-contact" label={t("Contact")}>
                  <Input
                    id="pos-customer-contact"
                    placeholder={t("Phone or email")}
                    value={customerContact}
                    onChange={(e) => handleCustomerContactChange(e.target.value)}
                    autoComplete="tel"
                  />
                </FormField>
                <FormField id="pos-outlet" label={t("Outlet")}>
                  <select
                    id="pos-outlet"
                    className="saleSelect"
                    value={outletId}
                    onChange={(e) => setOutletId(e.target.value)}
                  >
                    <option value="">{t("Select outlet")}</option>
                    {outletsForSelect.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField id="pos-payment-method" label={t("Payment method")}>
                  <PaymentMethodPicker
                    labelId="pos-payment-method"
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    t={t}
                  />
                </FormField>
              </div>
            </SaleFormSection>

            <SaleFormSection
              id="pos-section-add-line"
              title={editingLineIndex !== null ? t("Edit product line") : t("Add product line")}
              icon={<Package className="size-4" />}
              description={t("Select product, customer type, and pricing mode for each line.")}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="pos-product" label={t("Product")} className="sm:col-span-2">
                  <select
                    ref={productSelectRef}
                    id="pos-product"
                    className="saleSelect"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                  >
                    <option value="">{t("Select product")}</option>
                    {processedProductsForDropdown.map((p: Product) => (
                      <option key={p.id} value={p.id}>
                        {formatProcessedProductOptionLabel(
                          p,
                          outlets,
                          getProcessedProductAvailableKg(p),
                        )}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField id="pos-customer-type" label={t("Customer type")}>
                  <select
                    id="pos-customer-type"
                    className="saleSelect"
                    value={lineTypeId}
                    onChange={(e) => setLineTypeId(e.target.value)}
                  >
                    <option value="">{t("Retail / Wholesale")}</option>
                    {customerTypes.map((ct) => (
                      <option key={ct.id} value={ct.id}>
                        {ct.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="salePricingPanel">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{t("Pricing")}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {linePricingMode === "weight"
                        ? t("Enter weight to calculate the line total from the pricelist.")
                        : t("Enter a fixed line amount. Stock weight is derived from unit price.")}
                    </p>
                  </div>
                  <FormField id="pos-line-pricing-mode" label={t("Price by")} className="sm:max-w-[280px]">
                    <SegmentPicker
                      labelId="pos-line-pricing-mode"
                      value={linePricingMode}
                      options={linePricingOptions}
                      onChange={handleLinePricingModeChange}
                    />
                  </FormField>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {linePricingMode === "weight" ? (
                    <FormField id="pos-line-weight" label={t("Weight (kg)")}>
                      <Input
                        id="pos-line-weight"
                        type="number"
                        min={0}
                        step="any"
                        value={lineWeightInput}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setLineWeightInput(e.target.value)}
                      />
                    </FormField>
                  ) : (
                    <FormField id="pos-line-amount" label={t("Line amount (Rs.)")}>
                      <Input
                        id="pos-line-amount"
                        type="number"
                        min={0}
                        step="any"
                        value={lineAmountInput}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setLineAmountInput(e.target.value)}
                      />
                    </FormField>
                  )}
                  <FormField id="pos-unit-price" label={t("Unit price (Rs.)")}>
                    <Input
                      id="pos-unit-price"
                      readOnly
                      className="bg-muted"
                      value={
                        previewLineUnitPrice != null ? formatSaleAmount(previewLineUnitPrice) : ""
                      }
                      placeholder="—"
                    />
                  </FormField>
                  <FormField id="pos-line-total" label={t("Line total (Rs.)")}>
                    <div className="saleLineTotal" aria-live="polite">
                      {linePricingMode === "weight"
                        ? previewCalculatedLineAmount != null
                          ? formatSaleAmount(previewCalculatedLineAmount)
                          : "—"
                        : (() => {
                            const amount = Number(lineAmountInput);
                            return lineAmountInput.trim() &&
                              Number.isFinite(amount) &&
                              amount > 0
                              ? formatSaleAmount(amount)
                              : "—";
                          })()}
                    </div>
                  </FormField>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" className="gap-1.5" onClick={handleSaveLine}>
                  <Plus className="size-4" aria-hidden />
                  {editingLineIndex !== null ? t("Update line") : t("Add product")}
                </Button>
                {editingLineIndex !== null ? (
                  <Button type="button" variant="ghost" onClick={cancelEditLine}>
                    {t("Cancel")}
                  </Button>
                ) : null}
              </div>
            </SaleFormSection>

            {error ? (
              <Alert variant="destructive" className="mt-6">
                <AlertDescription>
                  {error}
                  {errorShowPricelistLink && accessTier === "global" ? (
                    <>
                      {" "}
                      <Link className="font-semibold underline underline-offset-2" to="/dashboard/dualPricing">
                        {t("Open Pricelist")}
                      </Link>
                    </>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-4">
          <Card className="shadow-sm">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-4 text-primary" aria-hidden />
                <div>
                  <CardTitle className="text-base">{t("Line items")}</CardTitle>
                  <CardDescription>{t("Products in this sale")}</CardDescription>
                </div>
              </div>
              {lineItems.length > 0 ? (
                <Badge variant="success">{lineItems.length}</Badge>
              ) : null}
            </CardHeader>
            <CardContent className="p-0 pt-0">
              <div className="saleTableWrap">
                <table className="saleTable saleTable--stack">
                  <thead>
                    <tr>
                      <th>{t("PRODUCT NAME")}</th>
                      <th>{t("TYPE")}</th>
                      <th>{t("Weight (kg)")}</th>
                      <th>{t("SUB-TOTAL")}</th>
                      <th>{t("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length === 0 ? (
                      <tr className="saleTableRow--empty">
                        <td colSpan={5} className="saleTableEmpty">
                          <div className="saleEmptyState">
                            <p className="saleEmptyStateTitle">{t("No products in this sale yet")}</p>
                            <p className="saleEmptyStateHint">
                              {t(
                                "Select product, retail or wholesale type, and weight (kg) above, then use Add Product.",
                              )}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      lineItems.map((item, index) => {
                        const sub = lineSubtotal(item);
                        const hasOverride =
                          item.amountOverride != null && item.amountOverride > 0;
                        return (
                          <tr
                            key={`${item.productId}-${index}`}
                            className={editingLineIndex === index ? "saleTableRow--editing" : undefined}
                          >
                            <td data-label={t("PRODUCT NAME")}>{item.productName}</td>
                            <td data-label={t("TYPE")}>
                              <Badge variant="secondary">{item.typeName}</Badge>
                            </td>
                            <td data-label={t("Weight (kg)")}>{item.weight}</td>
                            <td data-label={t("SUB-TOTAL")}>
                              <span>{formatSaleAmount(sub)}</span>
                              {hasOverride ? (
                                <Badge variant="warning" className="ml-2">
                                  {t("Custom")}
                                </Badge>
                              ) : null}
                            </td>
                            <td data-label={t("Actions")} className="saleTableCell--action">
                              <div className="saleLineActions">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="saleTableBtn h-8"
                                  onClick={() => startEditLine(index)}
                                >
                                  {t("Edit")}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="saleTableBtn h-8 text-destructive hover:text-destructive"
                                  onClick={() => removeLine(index)}
                                  disabled={editingLineIndex !== null && editingLineIndex !== index}
                                >
                                  {t("Delete")}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {lineItems.length > 0 ? (
                    <tfoot>
                      <tr className="saleTableFootRow">
                        <td colSpan={3} className="saleTotalLabel">
                          {t("Subtotal")}
                        </td>
                        <td className="saleTotalValue">{formatSaleAmount(subtotal)}</td>
                        <td className="saleTableFootSpacer" aria-hidden />
                      </tr>
                      <tr className="saleTableFootRow">
                        <td colSpan={3} className="saleTotalLabel">
                          <label htmlFor="pos-cart-discount">{t("Discount (Rs.)")}</label>
                        </td>
                        <td className="saleTotalValue">
                          <Input
                            id="pos-cart-discount"
                            className="h-8 max-w-[7.5rem]"
                            type="number"
                            min={0}
                            step="any"
                            value={cartDiscountInput}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => setCartDiscountInput(e.target.value)}
                          />
                        </td>
                        <td className="saleTableFootSpacer" aria-hidden />
                      </tr>
                      <tr className="saleTableFootRow">
                        <td colSpan={3} className="saleTotalLabel">
                          {t("Total due")}
                        </td>
                        <td className="saleTotalValue saleTotalValue--emphasis">
                          {formatSaleAmount(totalDue)}
                        </td>
                        <td className="saleTableFootSpacer" aria-hidden />
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-2 border-t bg-muted/20 pt-6">
              <div className="flex w-full items-center justify-between text-sm lg:hidden">
                <span className="font-medium text-muted-foreground">{t("Total due")}</span>
                <span className="text-lg font-bold text-primary">{formatSaleAmount(totalDue)}</span>
              </div>
              <Button
                type="button"
                className="h-11 w-full gap-2 rounded-full text-base font-semibold"
                onClick={handleCheckout}
                disabled={createSaleMutation.isPending || lineItems.length === 0}
              >
                <CreditCard className="size-4" aria-hidden />
                {createSaleMutation.isPending ? t("Processing…") : t("Checkout")}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <ConfirmModal
        isOpen={checkoutConfirmOpen}
        title={t("Confirm checkout")}
        message={checkoutConfirmMessage}
        confirmLabel={t("Checkout")}
        cancelLabel={t("Cancel")}
        loading={createSaleMutation.isPending}
        onClose={() => setCheckoutConfirmOpen(false)}
        onConfirm={doCheckout}
      />
    </SalePageLayout>
  );
}
