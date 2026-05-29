"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import ConfirmModal from "@/app/components/Modal/ConfirmModal";
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
  SALE_PAYMENT_METHOD_OPTIONS,
  type SalePaymentMethod,
} from "@/lib/salePaymentMethods";
import { validateProcessedSaleCreate } from "@/schema/sale";
import { readOutletScopeFromSearch } from "@/lib/outletScope";
import PosCustomerNameCombobox from "./PosCustomerNameCombobox";
import { findMatchingCustomer } from "./findMatchingCustomer";
import "./pos.scss";

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

  return (
    <section className="posPage">
      <div className="breadcrumb">
        <span>{t("Sales & Billing")}</span> {" > "} {t("Point of Sale")}
      </div>

      <div className="posHeader">
        <div className="posHeaderText">
          <h1 className="pageTitle">{t("Point of Sale")}</h1>
          <p className="pageSubtitle">
            {t("Scan barcode or search products")}
          </p>
        </div>
      </div>

      <div className="posCard posCard--primary">
        <header className="posCardHeader">
          <h2 className="posCardTitle">{t("Current Sale")}</h2>
          <p className="posCardDescription">
            {t(
              "Choose outlet and payment, add processed product lines, then checkout to record the sale."
            )}
          </p>
        </header>

        <section className="posSection" aria-labelledby="pos-section-customer">
          <h3 id="pos-section-customer" className="posSectionTitle">
            {t("Customer & outlet")}
          </h3>
          <div className="posFormRow posFormRow--customer">
            <label className="posField posField--customerName" htmlFor="pos-customer-name">
              <span className="posLabel">{t("Customer Details")}</span>
              <PosCustomerNameCombobox
                customers={allCustomers}
                outletId={outletId}
                value={customerName}
                onChange={handleCustomerNameChange}
                onSelectCustomer={applyRegisteredCustomer}
                t={t}
              />
            </label>
            <label className="posField posField--contact">
              <span className="posLabel">{t("Contact")}</span>
              <input
                className="posInput"
                placeholder={t("Phone or email")}
                value={customerContact}
                onChange={(e) => handleCustomerContactChange(e.target.value)}
                aria-label={t("Customer contact")}
                autoComplete="tel"
              />
            </label>
          </div>
          <div className="posFormRow posFormRow--outletPayment">
            <label className="posField">
              <span className="posLabel">{t("Outlet")}</span>
              <select
                className="posSelect"
                value={outletId}
                onChange={(e) => setOutletId(e.target.value)}
                aria-label={t("Outlet")}
              >
                <option value="">{t("Select outlet")}</option>
                {outletsForSelect.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="posField posField--segment posField--payment">
              <span className="posLabel" id="pos-payment-method-label">
                {t("Payment method")}
              </span>
              <div
                className="posSegment"
                role="radiogroup"
                aria-labelledby="pos-payment-method-label"
              >
                {SALE_PAYMENT_METHOD_OPTIONS.map((opt) => {
                  const selected = paymentMethod === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`posSegment__btn${selected ? " posSegment__btn--active" : ""}`}
                      onClick={() => setPaymentMethod(opt.value)}
                    >
                      {t(opt.label)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="posSection" aria-labelledby="pos-section-add-line">
          <h3 id="pos-section-add-line" className="posSectionTitle">
            {editingLineIndex !== null ? t("Edit product line") : t("Add product line")}
          </h3>

          <div className="posLineForm">
            <div className="posLineForm__row posLineForm__row--product">
              <label className="posField">
                <span className="posLabel">{t("Product")}</span>
                <select
                  ref={productSelectRef}
                  className="posSelect"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  aria-label={t("Product")}
                >
                  <option value="">{t("Select product")}</option>
                  {processedProductsForDropdown.map((p: Product) => (
                    <option key={p.id} value={p.id}>
                      {formatProcessedProductOptionLabel(
                        p,
                        outlets,
                        getProcessedProductAvailableKg(p)
                      )}
                    </option>
                  ))}
                </select>
              </label>
              <label className="posField">
                <span className="posLabel">{t("Customer type")}</span>
                <select
                  className="posSelect"
                  value={lineTypeId}
                  onChange={(e) => setLineTypeId(e.target.value)}
                  aria-label={t("Price type for this line (Retail/Wholesale)")}
                >
                  <option value="">{t("Retail / Wholesale")}</option>
                  {customerTypes.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="posLineForm__pricing">
              <div className="posLineForm__pricingTop">
                <div className="posLineForm__pricingIntro">
                  <span className="posLineForm__pricingTitle">{t("Pricing")}</span>
                  <p className="posLineForm__pricingDesc">
                    {linePricingMode === "weight"
                      ? t("Enter weight to calculate the line total from the pricelist.")
                      : t("Enter a fixed line amount. Stock weight is derived from unit price.")}
                  </p>
                </div>
                <div className="posField posField--segment">
                  <span className="posLabel" id="pos-line-pricing-mode-label">
                    {t("Price by")}
                  </span>
                  <div
                    className="posSegment"
                    role="radiogroup"
                    aria-labelledby="pos-line-pricing-mode-label"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={linePricingMode === "weight"}
                      className={`posSegment__btn${linePricingMode === "weight" ? " posSegment__btn--active" : ""}`}
                      onClick={() => handleLinePricingModeChange("weight")}
                    >
                      {t("Weight")}
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={linePricingMode === "amount"}
                      className={`posSegment__btn${linePricingMode === "amount" ? " posSegment__btn--active" : ""}`}
                      onClick={() => handleLinePricingModeChange("amount")}
                    >
                      {t("Fixed amount")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="posLineForm__pricingGrid">
                {linePricingMode === "weight" ? (
                  <label className="posField">
                    <span className="posLabel">{t("Weight (kg)")}</span>
                    <input
                      className="posInput"
                      type="number"
                      min={0}
                      step="any"
                      value={lineWeightInput}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setLineWeightInput(e.target.value)}
                      aria-label={t("Weight (kg)")}
                    />
                  </label>
                ) : (
                  <label className="posField">
                    <span className="posLabel">{t("Line amount (Rs.)")}</span>
                    <input
                      className="posInput"
                      type="number"
                      min={0}
                      step="any"
                      value={lineAmountInput}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setLineAmountInput(e.target.value)}
                      aria-label={t("Line amount")}
                    />
                  </label>
                )}

                <label className="posField">
                  <span className="posLabel">{t("Unit price (Rs.)")}</span>
                  <input
                    className="posInput posInput--readonly"
                    readOnly
                    value={
                      previewLineUnitPrice != null
                        ? formatSaleAmount(previewLineUnitPrice)
                        : ""
                    }
                    placeholder="—"
                    aria-label={t("Unit price")}
                  />
                </label>

                <div className="posField posField--summary">
                  <span className="posLabel">{t("Line total (Rs.)")}</span>
                  <div className="posLineTotal" aria-live="polite">
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
                </div>
              </div>
            </div>

            <div className="posLineForm__actions">
              <button type="button" className="posAddBtn" onClick={handleSaveLine}>
                {editingLineIndex !== null ? t("Update line") : t("+ Add product")}
              </button>
              {editingLineIndex !== null && (
                <button type="button" className="posCancelEditBtn" onClick={cancelEditLine}>
                  {t("Cancel")}
                </button>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div className="posErrorBlock" role="alert">
            <p className="posError">{error}</p>
            {errorShowPricelistLink && accessTier === "global" && (
              <p className="posErrorHint">
                <Link className="posErrorLink" to="/dashboard/dualPricing">
                  {t("Open Pricelist")}
                </Link>
              </p>
            )}
          </div>
        )}

        <section className="posSection posSection--flush" aria-labelledby="pos-section-cart">
          <div className="posTableHead">
            <h3 id="pos-section-cart" className="posSectionTitle posSectionTitle--inline">
              {t("Line items")}
            </h3>
            {lineItems.length > 0 && (
              <span className="posLineCount" title={t("Number of lines in this sale")}>
                {lineItems.length}
              </span>
            )}
          </div>
          <div className="posTableWrap">
            <table className="posTable posTable--stack">
              <thead>
                <tr>
                  <th>{t("PRODUCT NAME")}</th>
                  <th>{t("TYPE")}</th>
                  <th>{t("Weight (kg)")}</th>
                  <th>{t("SUB-TOTAL")}</th>
                  <th className="posRemoveHeader">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0 ? (
                  <tr className="posTableRow--empty">
                    <td colSpan={5} className="posTableEmpty">
                      <div className="posEmptyState">
                        <p className="posEmptyStateTitle">{t("No products in this sale yet")}</p>
                        <p className="posEmptyStateHint">
                          {t(
                            "Select product, retail or wholesale type, and weight (kg) above, then use Add Product."
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
                        className={editingLineIndex === index ? "posTableRow--editing" : undefined}
                      >
                        <td data-label={t("PRODUCT NAME")}>{item.productName}</td>
                        <td data-label={t("TYPE")}>
                          <span className="posLineTypeBadge">{item.typeName}</span>
                        </td>
                        <td data-label={t("Weight (kg)")}>{item.weight}</td>
                        <td data-label={t("SUB-TOTAL")}>
                          <span>{formatSaleAmount(sub)}</span>
                          {hasOverride && (
                            <span className="posOverrideBadge">{t("Custom")}</span>
                          )}
                        </td>
                        <td data-label={t("Actions")} className="posTableCell--action">
                          <div className="posLineActions">
                            <button
                              type="button"
                              className="posEditBtn"
                              onClick={() => startEditLine(index)}
                              aria-label={t("Edit line")}
                            >
                              {t("Edit")}
                            </button>
                            <button
                              type="button"
                              className="posRemoveBtn"
                              onClick={() => removeLine(index)}
                              aria-label={t("Remove line")}
                              disabled={editingLineIndex !== null && editingLineIndex !== index}
                            >
                              {t("Delete")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {lineItems.length > 0 && (
                <tfoot>
                  <tr className="posTableFootRow">
                    <td colSpan={3} className="posTotalLabel">
                      {t("Subtotal")}
                    </td>
                    <td className="posTotalValue">{formatSaleAmount(subtotal)}</td>
                    <td className="posTableFootSpacer" aria-hidden />
                  </tr>
                  <tr className="posTableFootRow posTableFootRow--discount">
                    <td colSpan={3} className="posTotalLabel">
                      <label htmlFor="pos-cart-discount">{t("Discount (Rs.)")}</label>
                    </td>
                    <td className="posTotalValue">
                      <input
                        id="pos-cart-discount"
                        className="posInput posInput--compact"
                        type="number"
                        min={0}
                        step="any"
                        value={cartDiscountInput}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setCartDiscountInput(e.target.value)}
                        aria-label={t("Discount (Rs.)")}
                      />
                    </td>
                    <td className="posTableFootSpacer" aria-hidden />
                  </tr>
                  <tr className="posTableFootRow posTableFootRow--totalDue">
                    <td colSpan={3} className="posTotalLabel">
                      {t("Total due")}
                    </td>
                    <td className="posTotalValue posTotalValue--emphasis">
                      {formatSaleAmount(totalDue)}
                    </td>
                    <td className="posTableFootSpacer" aria-hidden />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        <button
          type="button"
          className="posCheckoutBtn"
          onClick={handleCheckout}
          disabled={createSaleMutation.isPending || lineItems.length === 0}
        >
          {createSaleMutation.isPending ? t("Processing…") : t("Checkout")}
        </button>
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
    </section>
  );
}
