"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import {
  getLivestockItemsByProduct,
  getProducts,
  type LivestockItem,
  type Product,
} from "@/handlers/product";
import { getProductTypes } from "@/handlers/productType";
import {
  createLivestockSale,
  getLivestockSales,
  type LivestockSale,
  type LivestockSalePayload,
} from "@/handlers/sale";
import {
  DEFAULT_SALE_PAYMENT_METHOD,
  SALE_PAYMENT_METHOD_OPTIONS,
  type SalePaymentMethod,
} from "@/lib/salePaymentMethods";
import ConfirmModal from "@/app/components/Modal/ConfirmModal";
import "./livestock-sales.scss";

const LIVE_PRODUCT_TYPE_NAMES = ["live stock", "live"];
const PRODUCTS_QUERY_KEY = ["products"];
const PRODUCT_TYPES_QUERY_KEY = ["productTypes"];
const LIVESTOCK_ITEMS_QUERY_KEY = ["livestockItemsByProduct"];
const LIVESTOCK_SALES_QUERY_KEY = ["livestockSales"];

type LivestockLineItem = {
  name: string;
  contact: string;
  livestockItemId: string;
  livestockItemLabel: string;
  weight: number;
  amount: number;
};

async function fetchLivestockItemsWithLimit(
  productIds: string[],
  fetcher: (productId: string) => Promise<{ ok: true; data: LivestockItem[] } | { ok: false; error: string; status: number }>,
  concurrency = 2
): Promise<{ ok: true; data: LivestockItem[] } | { ok: false; error: string; status: number }> {
  const merged: LivestockItem[] = [];
  for (let i = 0; i < productIds.length; i += concurrency) {
    const batch = productIds.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((productId) => fetcher(productId)));
    for (const result of results) {
      // If API rate-limit is hit, keep already fetched items and stop burst.
      if (!result.ok && result.status === 429) {
        return { ok: true, data: merged };
      }
      if (!result.ok) return result;
      merged.push(...result.data);
    }
  }
  return { ok: true, data: merged };
}

function resolveLivestockItemId(item: LivestockItem): string | null {
  const withUnderscore = item as unknown as { _id?: unknown };
  const withLivestockItemId = item as unknown as { livestockItemId?: unknown };
  const fromId = typeof item.id === "string" ? item.id : null;
  const fromUnderscore = typeof withUnderscore._id === "string" ? withUnderscore._id : null;
  const fromLivestockItemId =
    typeof withLivestockItemId.livestockItemId === "string" ? withLivestockItemId.livestockItemId : null;
  return fromId ?? fromUnderscore ?? fromLivestockItemId ?? null;
}

/** Available quantity for dropdown labels: API head count, then legacy combined field. */
function resolveLivestockQuantityLabel(item: LivestockItem): string {
  const formatN = (n: number) =>
    Number.isInteger(n) || n % 1 === 0 ? String(n) : n.toFixed(2);
  if (typeof item.quantity === "number" && Number.isFinite(item.quantity)) {
    return formatN(item.quantity);
  }
  if (
    typeof item.itemQuantityOrWeight === "number" &&
    Number.isFinite(item.itemQuantityOrWeight)
  ) {
    return formatN(item.itemQuantityOrWeight);
  }
  return "\u2014";
}

export default function LivestockSalesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [selectedLivestockItemId, setSelectedLivestockItemId] = useState("");
  const [livestockWeight, setLivestockWeight] = useState("");
  const [livestockAmount, setLivestockAmount] = useState<number>(0);
  const [livestockLineItems, setLivestockLineItems] = useState<LivestockLineItem[]>([]);
  const [livestockError, setLivestockError] = useState<string | null>(null);
  const [loadLivestockItems, setLoadLivestockItems] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>(
    DEFAULT_SALE_PAYMENT_METHOD
  );
  const [lineIndexToDelete, setLineIndexToDelete] = useState<number | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
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
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await getProductTypes();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const liveTypeIds = useMemo(() => {
    const ids = new Set<string>();
    productTypes.forEach((pt) => {
      if (LIVE_PRODUCT_TYPE_NAMES.includes(pt.name.toLowerCase())) ids.add(pt.id);
    });
    return ids;
  }, [productTypes]);

  const liveStockProducts = useMemo(
    () =>
      products.filter((p: Product) => {
        const productTypeName =
          typeof p.productType === "object" && typeof p.productType?.name === "string"
            ? p.productType.name.toLowerCase()
            : "";
        return liveTypeIds.has(p.productTypeId) || LIVE_PRODUCT_TYPE_NAMES.includes(productTypeName);
      }),
    [products, liveTypeIds]
  );

  const liveStockProductIds = useMemo(
    () => liveStockProducts.map((product) => product.id).sort(),
    [liveStockProducts]
  );

  const { data: livestockItems = [] } = useQuery({
    queryKey: [...LIVESTOCK_ITEMS_QUERY_KEY, liveStockProductIds],
    enabled: loadLivestockItems && liveStockProductIds.length > 0,
    staleTime: 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const response = await fetchLivestockItemsWithLimit(
        liveStockProductIds,
        getLivestockItemsByProduct,
        2
      );
      if (!response.ok) {
        if (response.status === 401) navigate("/login");
        throw new Error(response.error);
      }
      const merged = response.data;
      const seen = new Set<string>();
      return merged.filter((item) => {
        const id = resolveLivestockItemId(item) ?? `${item.productId}-${item.itemId}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    },
  });

  const livestockOptions = useMemo(() => {
    return livestockItems
      .map((item) => {
        const id = resolveLivestockItemId(item);
        if (!id) return null;
        return {
          value: id,
          label: `${item.itemId} - ${item.name} (${resolveLivestockQuantityLabel(item)})`,
        };
      })
      .filter((option): option is { value: string; label: string } => option != null);
  }, [livestockItems, liveStockProducts]);

  const livestockOptionMap = useMemo(
    () => new Map(livestockOptions.map((option) => [option.value, option.label])),
    [livestockOptions]
  );

  const getLivestockDisplay = (sale: LivestockSale): string => {
    const id = typeof sale.livestockItemId === "string" ? sale.livestockItemId : "";
    if (id && livestockOptionMap.has(id)) return livestockOptionMap.get(id) ?? id;

    const firstItem =
      Array.isArray(sale.items) && sale.items.length > 0 && typeof sale.items[0] === "object"
        ? (sale.items[0] as Record<string, unknown>)
        : null;
    const livestockItemObj =
      firstItem && typeof firstItem.livestockItem === "object"
        ? (firstItem.livestockItem as Record<string, unknown>)
        : null;
    const itemId =
      (typeof livestockItemObj?.itemId === "string" && livestockItemObj.itemId) ||
      (typeof firstItem?.itemId === "string" && firstItem.itemId) ||
      "";
    const itemName =
      (typeof livestockItemObj?.name === "string" && livestockItemObj.name) ||
      (typeof firstItem?.name === "string" && firstItem.name) ||
      "";

    if (itemId || itemName) return [itemId, itemName].filter(Boolean).join(" - ");
    return id || "-";
  };

  const {
    data: livestockSales = [],
    isLoading: livestockSalesLoading,
    isError: livestockSalesIsError,
    error: livestockSalesErrorDetail,
  } = useQuery({
    queryKey: LIVESTOCK_SALES_QUERY_KEY,
    staleTime: 30 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const result = await getLivestockSales();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const livestockTotal = livestockLineItems.reduce(
    (sum, item) => sum + item.weight * item.amount,
    0
  );

  const handleAddLivestockLine = () => {
    if (!customerName.trim() || !customerContact.trim()) {
      setLivestockError(t("Enter customer details."));
      return;
    }
    if (!selectedLivestockItemId.trim()) {
      setLivestockError(t("Select livestock item."));
      return;
    }
    const parsedWeight = Number(livestockWeight);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setLivestockError(t("Quantity must be greater than 0."));
      return;
    }
    if (!Number.isFinite(livestockAmount) || livestockAmount <= 0) {
      setLivestockError(t("Amount must be greater than 0."));
      return;
    }

    setLivestockLineItems((prev) => [
      ...prev,
      {
        name: customerName.trim(),
        contact: customerContact.trim(),
        livestockItemId: selectedLivestockItemId.trim(),
        livestockItemLabel:
          livestockOptionMap.get(selectedLivestockItemId.trim()) ?? selectedLivestockItemId.trim(),
        weight: parsedWeight,
        amount: livestockAmount,
      },
    ]);
    setSelectedLivestockItemId("");
    setLivestockWeight("");
    setLivestockAmount(0);
    setLivestockError(null);
  };

  const removeLivestockLine = (index: number) => {
    setLivestockLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const linePendingDelete = useMemo(() => {
    if (lineIndexToDelete === null) return null;
    return livestockLineItems[lineIndexToDelete] ?? null;
  }, [lineIndexToDelete, livestockLineItems]);

  const handleConfirmRemoveLine = () => {
    if (lineIndexToDelete === null) return;
    const index = lineIndexToDelete;
    setLineIndexToDelete(null);
    removeLivestockLine(index);
  };

  const createLivestockSaleMutation = useMutation({
    mutationFn: (items: LivestockSalePayload[]) => createLivestockSale(items),
    onSuccess: (result) => {
      if (result.ok) {
        setLivestockLineItems([]);
        setCustomerName("");
        setCustomerContact("");
        setSelectedLivestockItemId("");
        setLivestockWeight("");
        setLivestockAmount(0);
        setPaymentMethod(DEFAULT_SALE_PAYMENT_METHOD);
        setLivestockError(null);
        queryClient.invalidateQueries({ queryKey: LIVESTOCK_SALES_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: ["dashboardSales"] });
        showToast(t("Livestock sale created successfully."), "success");
      } else {
        if (result.status === 401) navigate("/login");
        else {
          setLivestockError(result.error);
          showToast(result.error, "error");
        }
      }
    },
    onError: () => {
      const message = t("Something went wrong. Please try again.");
      setLivestockError(message);
      showToast(message, "error");
    },
  });

  const handleLivestockCheckout = () => {
    if (livestockLineItems.length === 0) {
      setLivestockError(t("Add at least one livestock item."));
      return;
    }
    setLivestockError(null);
    createLivestockSaleMutation.mutate(
      livestockLineItems.map((item) => ({
        name: item.name,
        contact: item.contact,
        livestockItemId: item.livestockItemId,
        itemQuantityOrWeight: item.weight,
        amount: item.amount,
        paymentMethod,
      }))
    );
  };

  return (
    <section className="livestockSalesPage">
      <div className="breadcrumb">
        <span>{t("Sales & Billing")}</span> {" > "} {t("Livestock Sales")}
      </div>

      <div className="pageHeader">
        <h1 className="pageTitle">{t("Livestock Sales")}</h1>
        <p className="pageSubtitle">{t("Create and track livestock sales")}</p>
      </div>

      <div className="salesCard salesCard--primary">
        <section className="livestockSection" aria-labelledby="livestock-section-customer">
          <h3 id="livestock-section-customer" className="livestockSectionTitle">
            {t("Customer & payment")}
          </h3>
          <div className="formGridCustomer">
            <label className="field">
              <span className="fieldLabel">{t("Customer Name")}</span>
              <input
                className="input"
                placeholder={t("Enter customer name")}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                autoComplete="name"
              />
            </label>
            <label className="field">
              <span className="fieldLabel">{t("Contact")}</span>
              <input
                className="input"
                placeholder={t("Phone or email")}
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                autoComplete="tel"
              />
            </label>
            <div className="field field--payment">
              <span className="fieldLabel" id="payment-method-label">
                {t("Payment method")}
              </span>
              <div
                className="paymentMethodGroup"
                role="radiogroup"
                aria-labelledby="payment-method-label"
              >
                {SALE_PAYMENT_METHOD_OPTIONS.map((opt) => {
                  const selected = paymentMethod === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`paymentMethodBtn${selected ? " paymentMethodBtn--active" : ""}`}
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

        <section className="livestockSection" aria-labelledby="livestock-section-lines">
          <h3 id="livestock-section-lines" className="livestockSectionTitle">
            {t("Add livestock line")}
          </h3>
          <div className="formGridAdd">
            <label className="field fieldLivestockSelect">
              <span className="fieldLabel">{t("Livestock Item ID")}</span>
              <select
                className="select"
                value={selectedLivestockItemId}
                onFocus={() => setLoadLivestockItems(true)}
                onClick={() => setLoadLivestockItems(true)}
                onChange={(e) => setSelectedLivestockItemId(e.target.value)}
              >
                <option value="">{t("Select livestock item")}</option>
                {livestockOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="formGridQtyPair">
              <label className="field fieldSm">
                <span className="fieldLabel">{t("Quantity")}</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="any"
                  value={livestockWeight}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setLivestockWeight(e.target.value)}
                  inputMode="decimal"
                />
              </label>
              <label className="field fieldSm">
                <span className="fieldLabel">{t("Amount")}</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="any"
                  value={livestockAmount || ""}
                  onChange={(e) => setLivestockAmount(Number(e.target.value) || 0)}
                  inputMode="decimal"
                />
              </label>
            </div>
            <button type="button" className="addBtn" onClick={handleAddLivestockLine}>
              {t("+ Add Livestock")}
            </button>
          </div>
        </section>

        {livestockError && (
          <p className="error" role="alert">
            {livestockError}
          </p>
        )}

        <section className="livestockSection livestockSection--flush" aria-labelledby="livestock-section-cart">
          <div className="livestockTableHead">
            <h3 id="livestock-section-cart" className="livestockSectionTitle livestockSectionTitle--inline">
              {t("Current sale")}
            </h3>
            {livestockLineItems.length > 0 && (
              <span
                className="livestockLineCount"
                title={t("Number of lines in this sale")}
              >
                {livestockLineItems.length}
              </span>
            )}
          </div>
          <div className="tableWrap tableWrap--mobileCards">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th>{t("Name")}</th>
                  <th>{t("Contact")}</th>
                  <th>{t("Livestock Item ID")}</th>
                  <th>{t("Quantity")}</th>
                  <th>{t("Amount")}</th>
                  <th>{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {livestockLineItems.length === 0 ? (
                  <tr className="tableRow--empty">
                    <td colSpan={6} className="emptyCell">
                      <div className="emptyState">
                        <p className="emptyStateTitle">{t("No lines in this sale yet")}</p>
                        <p className="emptyStateHint">
                          {t(
                            "Choose an item, quantity, and amount above, then use Add Livestock."
                          )}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  livestockLineItems.map((item, index) => (
                    <tr key={`${item.livestockItemId}-${index}`}>
                      <td data-label={t("Name")}>{item.name}</td>
                      <td data-label={t("Contact")}>{item.contact}</td>
                      <td data-label={t("Livestock Item ID")}>{item.livestockItemLabel}</td>
                      <td data-label={t("Quantity")}>{item.weight}</td>
                      <td data-label={t("Amount")}>{item.amount}</td>
                      <td data-label={t("Actions")} className="tableCell--action">
                        <button
                          type="button"
                          className="removeBtn"
                          onClick={() => setLineIndexToDelete(index)}
                        >
                          {t("Delete")}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {livestockLineItems.length > 0 && (
                <tfoot>
                  <tr className="tableFootRow">
                    <td colSpan={4} className="totalLabel">
                      {t("Total")}
                    </td>
                    <td className="totalValue">{livestockTotal}</td>
                    <td className="tableFootSpacer" aria-hidden />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        <button
          type="button"
          className="submitBtn"
          onClick={handleLivestockCheckout}
          disabled={createLivestockSaleMutation.isPending || livestockLineItems.length === 0}
        >
          {createLivestockSaleMutation.isPending ? t("Processing…") : t("Submit Livestock Sale")}
        </button>
      </div>

      <div className="salesCard">
        <header className="salesCardHeader salesCardHeader--compact">
          <h2 className="cardTitle">{t("Live Stock Sale Details")}</h2>
          <p className="cardDescription">{t("Recent livestock sales from your account.")}</p>
        </header>
        <div className="tableWrap tableWrap--tight tableWrap--mobileCards">
          <table className="table table--stack table--saleDetails">
            <thead>
              <tr>
                <th>{t("Name")}</th>
                <th>{t("Contact")}</th>
                <th>{t("Livestock Item ID")}</th>
                <th>{t("Quantity")}</th>
                <th>{t("Amount")}</th>
                <th>{t("Date")}</th>
              </tr>
            </thead>
            <tbody>
              {livestockSalesLoading && (
                <tr className="tableRow--empty">
                  <td colSpan={6} className="emptyCell">{t("Loading livestock sales...")}</td>
                </tr>
              )}
              {livestockSalesIsError && (
                <tr className="tableRow--empty">
                  <td colSpan={6} className="emptyCell">
                    {livestockSalesErrorDetail instanceof Error
                      ? livestockSalesErrorDetail.message
                      : t("Failed to load livestock sales")}
                  </td>
                </tr>
              )}
              {!livestockSalesLoading && !livestockSalesIsError && livestockSales.length === 0 && (
                <tr className="tableRow--empty">
                  <td colSpan={6} className="emptyCell">{t("No livestock sales yet.")}</td>
                </tr>
              )}
              {!livestockSalesLoading &&
                !livestockSalesIsError &&
                livestockSales.map((sale: LivestockSale, index: number) => (
                  <tr key={sale.id ?? sale.transactionId ?? `${sale.livestockItemId ?? "item"}-${index}`}>
                    <td data-label={t("Name")}>{String(sale.name ?? "-")}</td>
                    <td data-label={t("Contact")}>{String(sale.contact ?? "-")}</td>
                    <td data-label={t("Livestock Item ID")}>{getLivestockDisplay(sale)}</td>
                    <td data-label={t("Quantity")}>
                      {sale.quantity ?? sale.itemQuantityOrWeight ?? sale.weight ?? "-"}
                    </td>
                    <td data-label={t("Amount")}>{sale.amount ?? "-"}</td>
                    <td data-label={t("Date")}>{String(sale.createdAt ?? "-")}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmModal
        isOpen={lineIndexToDelete !== null && linePendingDelete !== null}
        title={t("Remove sale line")}
        message={
          linePendingDelete
            ? `${t("Are you sure you want to remove this livestock sale line?")} "${linePendingDelete.livestockItemLabel}" (${t("Quantity")}: ${linePendingDelete.weight}, ${t("Amount")}: ${linePendingDelete.amount}). ${t("This action cannot be undone.")}`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={false}
        onClose={() => setLineIndexToDelete(null)}
        onConfirm={handleConfirmRemoveLine}
      />
    </section>
  );
}
