"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import ConfirmModal from "@/app/components/Modal/ConfirmModal";
import { useAuth } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { getCustomerTypes } from "@/handlers/customerType";
import { getDualPricings, type DualPricing } from "@/handlers/dualPricing";
import { getOutlets } from "@/handlers/outlet";
import { getProducts, type Product } from "@/handlers/product";
import { getProductTypes } from "@/handlers/productType";
import { createSale } from "@/handlers/sale";
import "./pos.scss";

const PRODUCTS_QUERY_KEY = ["products"];
const PRODUCT_TYPES_QUERY_KEY = ["productTypes"];
const OUTLETS_QUERY_KEY = ["outlets"];
const DUAL_PRICING_QUERY_KEY = ["dualPricing"];
const CUSTOMER_TYPES_QUERY_KEY = ["customerTypes"];

type LineItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  customerTypeId: string;
  typeName: string;
  stockAvailable: number;
};

function getUnitPrice(
  dualPricings: DualPricing[],
  productId: string,
  outletId: string,
  isWholesale: boolean
): number {
  const dp = dualPricings.find(
    (d) => d.productId === productId && d.outletId === outletId
  );
  if (!dp) return 0;
  return isWholesale ? dp.wholesalePrice : dp.retailPrice;
}

export default function PointOfSalePage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showToast } = useToast();
  const { userOutletId } = useAuth();
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [outletId, setOutletId] = useState("");
  const [productId, setProductId] = useState("");
  const [lineTypeId, setLineTypeId] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checkoutConfirmOpen, setCheckoutConfirmOpen] = useState(false);
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

  const outletsForSelect =
    userOutletId != null
      ? outlets.filter((o) => o.id === userOutletId)
      : outlets;

  useEffect(() => {
    if (userOutletId && outlets.length > 0 && !outletId) {
      const allowed = outlets.some((o) => o.id === userOutletId);
      if (allowed) setOutletId(userOutletId);
    }
  }, [userOutletId, outlets, outletId]);

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

  const processedProducts = useMemo(() => {
    return products.filter((p: Product) => {
      const ptName =
        (p as Product & { productType?: { name?: string } })?.productType?.name ??
        productTypes.find((pt: { id: string; name: string }) => pt.id === p.productTypeId)?.name ??
        "";
      return ptName.toLowerCase() === "processed";
    });
  }, [products, productTypes]);

  const handleAddProduct = () => {
    if (!productId || !outletId) {
      setError(t("Select product and outlet."));
      return;
    }
    if (!lineTypeId) {
      setError(t("Select type (Retail/Wholesale) for this product."));
      return;
    }
    const product = products.find((p: Product) => p.id === productId);
    const stockAvailable =
      typeof product?.weight === "number"
        ? product.weight
        : typeof product?.quantity === "number"
          ? product.quantity
          : 0;
    const selectedQty = Number(quantity) || 1;
    if (selectedQty > stockAvailable) {
      setError(
        t(`Insufficient stock for product ${product?.name ?? "-"} (available: ${stockAvailable}).`)
      );
      return;
    }
    const selectedType = customerTypes.find((ct) => ct.id === lineTypeId);
    const isWholesale = selectedType?.name?.toLowerCase().includes("wholesale") ?? false;
    const unitPrice = getUnitPrice(
      dualPricings,
      productId,
      outletId,
      isWholesale
    );
    setLineItems((prev) => [
      ...prev,
      {
        productId,
        productName: product?.name ?? "-",
        quantity: selectedQty,
        unitPrice,
        customerTypeId: lineTypeId,
        typeName: selectedType?.name ?? "-",
        stockAvailable,
      },
    ]);
    setQuantity(1);
    setProductId("");
    setError(null);
  };

  const removeLine = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const total = lineItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  const createSaleMutation = useMutation({
    mutationFn: (items: {
      name: string;
      contact: string;
      customerTypeId: string;
      productId: string;
      outletId: string;
      weight?: number;
      quantity?: number;
    }[]) =>
      createSale(items),
    onSuccess: (result) => {
      if (result.ok) {
        setLineItems([]);
        setCustomerName("");
        setCustomerContact("");
        setError(null);
        navigate("/dashboard/invoices/transaction");
      } else {
        if (result.status === 401) navigate("/login");
        else {
          setError(result.error);
          showToast(result.error, "error");
        }
      }
    },
    onError: () => {
      const message = t("Something went wrong. Please try again.");
      setError(message);
      showToast(message, "error");
    },
  });

  const doCheckout = () => {
    const items = lineItems.map((item) => ({
      name: customerName.trim(),
      contact: customerContact.trim(),
      customerTypeId: item.customerTypeId,
      productId: item.productId,
      outletId,
      // For processed sales backend stock checks align better with weight.
      weight: item.quantity,
    }));
    createSaleMutation.mutate(items);
    setCheckoutConfirmOpen(false);
  };

  const handleCheckout = () => {
    if (!outletId || lineItems.length === 0) {
      setError(t("Add at least one product and select an outlet."));
      return;
    }
    if (!customerName.trim()) {
      setError(t("Enter customer details."));
      return;
    }
    setError(null);
    setCheckoutConfirmOpen(true);
  };

  return (
    <section className="posPage">
      <div className="breadcrumb">
        <span>{t("Sales & Billing")}</span> {" > "} {t("Transaction")}
      </div>

      <div className="posHeader">
        <div className="posHeaderText">
          <h1 className="pageTitle">{t("Point of Sale")}</h1>
          <p className="pageSubtitle">
            {t("Scan barcode or search products")}
          </p>
        </div>
      </div>

      <div className="posCard">
        <h2 className="posCardTitle">{t("Current Sale")}</h2>

        <div className="posFormRow">
          <label className="posField">
            <span className="posLabel">{t("Customer Details")}</span>
            <input
              className="posInput"
              placeholder={t("Enter customer details")}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              aria-label={t("Customer name")}
            />
          </label>
          <label className="posField">
            <span className="posLabel">{t("Contact")}</span>
            <input
              className="posInput"
              placeholder={t("Phone or email")}
              value={customerContact}
              onChange={(e) => setCustomerContact(e.target.value)}
              aria-label={t("Customer contact")}
            />
          </label>
        </div>

        <div className="posFormRow">
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
        </div>

        <div className="posFormRow posFormRowAdd">
          <label className="posField">
            <span className="posLabel">{t("Product Name")}</span>
            <select
              ref={productSelectRef}
              className="posSelect"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              aria-label={t("Product")}
            >
              <option value="">{t("Select product")}</option>
              {processedProducts.map((p: Product) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="posField">
            <span className="posLabel">{t("Type")}</span>
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
          <label className="posField posFieldQty">
            <span className="posLabel">{t("Quantity")}</span>
            <input
              className="posInput"
              type="number"
              min={1}
              step={1}
              value={quantity || ""}
              onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 0)))}
              aria-label={t("Quantity")}
            />
          </label>
          <button
            type="button"
            className="posAddBtn"
            onClick={handleAddProduct}
          >
            {t("+ Add Product")}
          </button>
        </div>

        {error && (
          <p className="posError" role="alert">
            {error}
          </p>
        )}

        <div className="posTableWrap">
          <table className="posTable">
            <thead>
              <tr>
                <th>{t("PRODUCT NAME")}</th>
                <th>{t("TYPE")}</th>
                <th>{t("QUANTITY")}</th>
                <th>{t("SUB-TOTAL")}</th>
                <th aria-label={t("Remove")} />
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="posTableEmpty">
                    {t(
                      "No products added. Select product, type (Retail/Wholesale), and quantity above."
                    )}
                  </td>
                </tr>
              ) : (
                lineItems.map((item, index) => (
                  <tr key={`${item.productId}-${index}`}>
                    <td>{item.productName}</td>
                    <td>
                      <span className="posLineTypeBadge">{item.typeName}</span>
                    </td>
                    <td>{item.quantity}</td>
                    <td>
                      {item.quantity !== 1
                        ? `${item.unitPrice}x${item.quantity}`
                        : String(item.unitPrice * item.quantity)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="posRemoveBtn"
                        onClick={() => removeLine(index)}
                        aria-label={t("Remove line")}
                      >
                        x
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {lineItems.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3} className="posTotalLabel">
                    {t("Total")}
                  </td>
                  <td className="posTotalValue">{total}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

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
        message={t(
          "Are you sure you want to checkout? This will complete the sale and add it to transactions."
        )}
        confirmLabel={t("Checkout")}
        cancelLabel={t("Cancel")}
        loading={createSaleMutation.isPending}
        onClose={() => setCheckoutConfirmOpen(false)}
        onConfirm={doCheckout}
      />
    </section>
  );
}
