"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import {
  deleteLivestockItem,
  getLivestockItemsByProduct,
  getProducts,
  updateLivestockItem,
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

function resolveLivestockItemId(item: LivestockItem): string | null {
  const withUnderscore = item as unknown as { _id?: unknown };
  const withLivestockItemId = item as unknown as { livestockItemId?: unknown };
  const fromId = typeof item.id === "string" ? item.id : null;
  const fromUnderscore = typeof withUnderscore._id === "string" ? withUnderscore._id : null;
  const fromLivestockItemId =
    typeof withLivestockItemId.livestockItemId === "string" ? withLivestockItemId.livestockItemId : null;
  return fromId ?? fromUnderscore ?? fromLivestockItemId ?? null;
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
    enabled: liveStockProductIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        liveStockProductIds.map((productId) => getLivestockItemsByProduct(productId))
      );
      const merged: LivestockItem[] = [];
      for (const result of results) {
        if (!result.ok) {
          if (result.status === 401) navigate("/login");
          throw new Error(result.error);
        }
        merged.push(...result.data);
      }
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
          label: `${item.itemId} - ${item.name}`,
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
    retry: 0,
    queryFn: async () => {
      const result = await getLivestockSales();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const livestockTotal = livestockLineItems.reduce((sum, item) => sum + item.amount, 0);

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
      setLivestockError(t("Weight must be greater than 0."));
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

  const createLivestockSaleMutation = useMutation({
    mutationFn: (items: LivestockSalePayload[]) => createLivestockSale(items),
    onSuccess: async (result) => {
      if (result.ok) {
        const soldWeightById = new Map<string, number>();
        livestockLineItems.forEach((line) => {
          soldWeightById.set(
            line.livestockItemId,
            (soldWeightById.get(line.livestockItemId) ?? 0) + Number(line.weight)
          );
        });

        const stockResults = await Promise.all(
          Array.from(soldWeightById.entries()).map(async ([id, soldWeight]) => {
            const currentItem = livestockItems.find((item) => resolveLivestockItemId(item) === id);
            if (!currentItem) {
              return { ok: false as const, error: t("Failed to resolve livestock item for stock deduction.") };
            }
            const currentWeight =
              typeof currentItem.itemQuantityOrWeight === "number"
                ? currentItem.itemQuantityOrWeight
                : Number(currentItem.weight);
            const remainingWeight = currentWeight - soldWeight;
            if (remainingWeight < 0) {
              return { ok: false as const, error: t("Insufficient livestock stock for deduction.") };
            }
            if (remainingWeight === 0) {
              return deleteLivestockItem({ id });
            }
            return updateLivestockItem({
              id,
              name: currentItem.name,
              itemId: currentItem.itemId,
              productId: currentItem.productId,
              itemQuantityOrWeight: remainingWeight,
              price: Number(currentItem.price),
              status: Boolean(currentItem.status),
            });
          })
        );
        const hasStockError = stockResults.some((res) => !res.ok);
        const stockErrorMessage = stockResults.find((res) => !res.ok)?.error;

        setLivestockLineItems([]);
        setCustomerName("");
        setCustomerContact("");
        setSelectedLivestockItemId("");
        setLivestockWeight("");
        setLivestockAmount(0);
        setLivestockError(null);
        queryClient.invalidateQueries({ queryKey: LIVESTOCK_SALES_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: ["dashboardSales"] });
        queryClient.invalidateQueries({ queryKey: LIVESTOCK_ITEMS_QUERY_KEY });
        if (hasStockError) {
          showToast(
            stockErrorMessage ?? t("Sale created, but stock deduction failed for some livestock items."),
            "error"
          );
        } else {
          showToast(t("Livestock sale created successfully."), "success");
        }
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
        weight: item.weight,
        amount: item.amount,
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

      <div className="salesCard">
        <h2 className="cardTitle">{t("Livestock Sales")}</h2>

        <div className="formGridTwo">
          <label className="field">
            <span>{t("Customer Name")}</span>
            <input
              className="input"
              placeholder={t("Enter customer name")}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{t("Contact")}</span>
            <input
              className="input"
              placeholder={t("Phone or email")}
              value={customerContact}
              onChange={(e) => setCustomerContact(e.target.value)}
            />
          </label>
        </div>

        <div className="formGridAdd">
          <label className="field">
            <span>{t("Livestock Item ID")}</span>
            <select
              className="select"
              value={selectedLivestockItemId}
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
          <label className="field fieldSm">
            <span>{t("Weight")}</span>
            <input
              className="input"
              type="number"
              min={0}
              step="any"
              value={livestockWeight}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setLivestockWeight(e.target.value)}
            />
          </label>
          <label className="field fieldSm">
            <span>{t("Amount")}</span>
            <input
              className="input"
              type="number"
              min={0}
              step="any"
              value={livestockAmount || ""}
              onChange={(e) => setLivestockAmount(Number(e.target.value) || 0)}
            />
          </label>
          <button type="button" className="addBtn" onClick={handleAddLivestockLine}>
            {t("+ Add Livestock")}
          </button>
        </div>

        {livestockError && <p className="error">{livestockError}</p>}

        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Name")}</th>
                <th>{t("Contact")}</th>
                <th>{t("Livestock Item ID")}</th>
                <th>{t("Weight")}</th>
                <th>{t("Amount")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {livestockLineItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="emptyCell">{t("No livestock lines added yet.")}</td>
                </tr>
              ) : (
                livestockLineItems.map((item, index) => (
                  <tr key={`${item.livestockItemId}-${index}`}>
                    <td>{item.name}</td>
                    <td>{item.contact}</td>
                    <td>{item.livestockItemLabel}</td>
                    <td>{item.weight}</td>
                    <td>{item.amount}</td>
                    <td>
                      <button
                        type="button"
                        className="removeBtn"
                        onClick={() => removeLivestockLine(index)}
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
                <tr>
                  <td colSpan={4} className="totalLabel">{t("Total")}</td>
                  <td className="totalValue">{livestockTotal}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

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
        <h2 className="cardTitle">{t("Live Stock Sale Details")}</h2>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Name")}</th>
                <th>{t("Contact")}</th>
                <th>{t("Livestock Item ID")}</th>
                <th>{t("Weight")}</th>
                <th>{t("Amount")}</th>
                <th>{t("Date")}</th>
              </tr>
            </thead>
            <tbody>
              {livestockSalesLoading && (
                <tr>
                  <td colSpan={6} className="emptyCell">{t("Loading livestock sales...")}</td>
                </tr>
              )}
              {livestockSalesIsError && (
                <tr>
                  <td colSpan={6} className="emptyCell">
                    {livestockSalesErrorDetail instanceof Error
                      ? livestockSalesErrorDetail.message
                      : t("Failed to load livestock sales")}
                  </td>
                </tr>
              )}
              {!livestockSalesLoading && !livestockSalesIsError && livestockSales.length === 0 && (
                <tr>
                  <td colSpan={6} className="emptyCell">{t("No livestock sales yet.")}</td>
                </tr>
              )}
              {!livestockSalesLoading &&
                !livestockSalesIsError &&
                livestockSales.map((sale: LivestockSale, index: number) => (
                  <tr key={sale.id ?? sale.transactionId ?? `${sale.livestockItemId ?? "item"}-${index}`}>
                    <td>{String(sale.name ?? "-")}</td>
                    <td>{String(sale.contact ?? "-")}</td>
                    <td>{getLivestockDisplay(sale)}</td>
                    <td>{sale.weight ?? "-"}</td>
                    <td>{sale.amount ?? "-"}</td>
                    <td>{String(sale.createdAt ?? "-")}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
