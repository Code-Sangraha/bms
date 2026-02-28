"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ConfirmModal from "@/app/components/Modal/ConfirmModal";
import { useAuth } from "@/app/providers/AuthProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { getCustomerTypes } from "@/handlers/customerType";
import { getDualPricings } from "@/handlers/dualPricing";
import { getOutlets } from "@/handlers/outlet";
import { getProducts } from "@/handlers/product";
import { getProductTypes } from "@/handlers/productType";
import { createSale } from "@/handlers/sale";
import type { DualPricing } from "@/handlers/dualPricing";
import type { Product } from "@/handlers/product";
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
  const router = useRouter();
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
        if (result.status === 401) router.push("/login");
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
        if (result.status === 401) router.push("/login");
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
        if (result.status === 401) router.push("/login");
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
        if (result.status === 401) router.push("/login");
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
      setError("Select product and outlet.");
      return;
    }
    if (!lineTypeId) {
      setError("Select type (Retail/Wholesale) for this product.");
      return;
    }
    const product = products.find((p: Product) => p.id === productId);
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
        productName: product?.name ?? "—",
        quantity: Number(quantity) || 1,
        unitPrice,
        customerTypeId: lineTypeId,
        typeName: selectedType?.name ?? "—",
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
    mutationFn: (items: { name: string; contact: string; customerTypeId: string; productId: string; outletId: string; quantity: number }[]) =>
      createSale(items),
    onSuccess: (result) => {
      if (result.ok) {
        setLineItems([]);
        setCustomerName("");
        setCustomerContact("");
        setError(null);
        router.push("/dashboard/invoices/transaction");
      } else {
        if (result.status === 401) router.push("/login");
        else {
          setError(result.error);
          showToast(result.error, "error");
        }
      }
    },
    onError: () => {
      setError("Something went wrong. Please try again.");
      showToast("Something went wrong. Please try again.", "error");
    },
  });

  const doCheckout = () => {
    const items = lineItems.map((item) => ({
      name: customerName.trim(),
      contact: customerContact.trim(),
      customerTypeId: item.customerTypeId,
      productId: item.productId,
      outletId,
      quantity: item.quantity,
    }));
    createSaleMutation.mutate(items);
    setCheckoutConfirmOpen(false);
  };

  const handleCheckout = () => {
    if (!outletId || lineItems.length === 0) {
      setError("Add at least one product and select an outlet.");
      return;
    }
    if (!customerName.trim()) {
      setError("Enter customer details.");
      return;
    }
    setError(null);
    setCheckoutConfirmOpen(true);
  };

  return (
    <section className="posPage">
      <div className="breadcrumb">
        <span>Sales & Billing</span> {"›"} Transaction
      </div>

      <div className="posHeader">
        <div className="posHeaderText">
          <h1 className="pageTitle">Point of Sale</h1>
          <p className="pageSubtitle">
            Scan barcode or search products
          </p>
        </div>
      </div>

      <div className="posCard">
        <h2 className="posCardTitle">Current Sale</h2>

        <div className="posFormRow">
          <label className="posField">
            <span className="posLabel">Customer Details</span>
            <input
              className="posInput"
              placeholder="Enter customer details"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              aria-label="Customer name"
            />
          </label>
          <label className="posField">
            <span className="posLabel">Contact</span>
            <input
              className="posInput"
              placeholder="Phone or email"
              value={customerContact}
              onChange={(e) => setCustomerContact(e.target.value)}
              aria-label="Customer contact"
            />
          </label>
        </div>

        <div className="posFormRow">
          <label className="posField">
            <span className="posLabel">Outlet</span>
            <select
              className="posSelect"
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
              aria-label="Outlet"
            >
              <option value="">Select outlet</option>
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
            <span className="posLabel">Product Name</span>
            <select
              ref={productSelectRef}
              className="posSelect"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              aria-label="Product"
            >
              <option value="">Select product</option>
              {processedProducts.map((p: Product) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="posField">
            <span className="posLabel">Type</span>
            <select
              className="posSelect"
              value={lineTypeId}
              onChange={(e) => setLineTypeId(e.target.value)}
              aria-label="Price type for this line (Retail/Wholesale)"
            >
              <option value="">Retail / Wholesale</option>
              {customerTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.name}
                </option>
              ))}
            </select>
          </label>
          <label className="posField posFieldQty">
            <span className="posLabel">Quantity</span>
            <input
              className="posInput"
              type="number"
              min={1}
              step={1}
              value={quantity || ""}
              onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 0)))}
              aria-label="Quantity"
            />
          </label>
          <button
            type="button"
            className="posAddBtn"
            onClick={handleAddProduct}
          >
            + Add Product
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
                <th>PRODUCT NAME</th>
                <th>TYPE</th>
                <th>QUANTITY</th>
                <th>SUB-TOTAL</th>
                <th aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="posTableEmpty">
                    No products added. Select product, type (Retail/Wholesale), and quantity above.
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
                        ? `${item.unitPrice}×${item.quantity}`
                        : String(item.unitPrice * item.quantity)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="posRemoveBtn"
                        onClick={() => removeLine(index)}
                        aria-label="Remove line"
                      >
                        ×
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
                    Total
                  </td>
                  <td className="posTotalValue">{total}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* <button
          type="button"
          className="posAddMoreBtn"
          onClick={() => productSelectRef.current?.focus()}
        >
          + Add more products
        </button> */}

        <button
          type="button"
          className="posCheckoutBtn"
          onClick={handleCheckout}
          disabled={createSaleMutation.isPending || lineItems.length === 0}
        >
          {createSaleMutation.isPending ? "Processing…" : "Checkout"}
        </button>
      </div>

      <ConfirmModal
        isOpen={checkoutConfirmOpen}
        title="Confirm checkout"
        message="Are you sure you want to checkout? This will complete the sale and add it to transactions."
        confirmLabel="Checkout"
        cancelLabel="Cancel"
        loading={createSaleMutation.isPending}
        onClose={() => setCheckoutConfirmOpen(false)}
        onConfirm={doCheckout}
      />
    </section>
  );
}
