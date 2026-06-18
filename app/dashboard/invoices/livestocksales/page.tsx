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
  LIVESTOCK_SALES_LIST_DEFAULT_LIMIT,
  type LivestockSale,
  type LivestockSalePayload,
} from "@/handlers/sale";
import {
  DEFAULT_SALE_PAYMENT_METHOD,
  type SalePaymentMethod,
} from "@/lib/salePaymentMethods";
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
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import { ErrorState } from "@/app/components/ui-ext/ErrorState";
import { TableSkeleton } from "@/app/components/ui-ext/LoadingState";
import { PaymentMethodPicker } from "@/app/dashboard/invoices/components/PaymentMethodPicker";
import { SaleFormSection } from "@/app/dashboard/invoices/components/SaleFormSection";
import { SalePageLayout } from "@/app/dashboard/invoices/components/SalePageLayout";
import { Plus, UserRound } from "lucide-react";
import "../components/sale-entry.scss";

const LIVE_PRODUCT_TYPE_NAMES = ["live stock", "live"];
const PRODUCTS_QUERY_KEY = ["products"];
const PRODUCT_TYPES_QUERY_KEY = ["productTypes"];
const LIVESTOCK_ITEMS_QUERY_KEY = ["livestockItemsByProduct"];

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
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [salesListPage, setSalesListPage] = useState(1);
  const [salesListPageSize, setSalesListPageSize] = useState(LIVESTOCK_SALES_LIST_DEFAULT_LIMIT);

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
    data: livestockPage,
    isLoading: livestockSalesLoading,
    isError: livestockSalesIsError,
    error: livestockSalesErrorDetail,
  } = useQuery({
    queryKey: ["livestockSales", "list", salesListPage, salesListPageSize],
    staleTime: 30 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const result = await getLivestockSales({
        page: salesListPage,
        limit: salesListPageSize,
      });
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const livestockSales = livestockPage?.rows ?? [];

  const livestockTotal = livestockLineItems.reduce(
    (sum, item) => sum + item.weight * item.amount,
    0
  );

  const clearLivestockLineForm = () => {
    setSelectedLivestockItemId("");
    setLivestockWeight("");
    setLivestockAmount(0);
    setEditingLineIndex(null);
  };

  const startEditLivestockLine = (index: number) => {
    const line = livestockLineItems[index];
    if (!line) return;
    setEditingLineIndex(index);
    setCustomerName(line.name);
    setCustomerContact(line.contact);
    setSelectedLivestockItemId(line.livestockItemId);
    setLivestockWeight(String(line.weight));
    setLivestockAmount(line.amount);
    setLivestockError(null);
  };

  const cancelEditLivestockLine = () => {
    clearLivestockLineForm();
    setLivestockError(null);
  };

  const handleSaveLivestockLine = () => {
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

    const nextLine: LivestockLineItem = {
      name: customerName.trim(),
      contact: customerContact.trim(),
      livestockItemId: selectedLivestockItemId.trim(),
      livestockItemLabel:
        livestockOptionMap.get(selectedLivestockItemId.trim()) ?? selectedLivestockItemId.trim(),
      weight: parsedWeight,
      amount: livestockAmount,
    };

    if (editingLineIndex !== null) {
      setLivestockLineItems((prev) =>
        prev.map((item, i) => (i === editingLineIndex ? nextLine : item))
      );
    } else {
      setLivestockLineItems((prev) => [...prev, nextLine]);
    }
    clearLivestockLineForm();
    setLivestockError(null);
  };

  const removeLivestockLine = (index: number) => {
    setLivestockLineItems((prev) => prev.filter((_, i) => i !== index));
    if (editingLineIndex === index) {
      clearLivestockLineForm();
    } else if (editingLineIndex !== null && index < editingLineIndex) {
      setEditingLineIndex(editingLineIndex - 1);
    }
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
        clearLivestockLineForm();
        setPaymentMethod(DEFAULT_SALE_PAYMENT_METHOD);
        setLivestockError(null);
        queryClient.invalidateQueries({ queryKey: ["livestockSales"] });
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
    <SalePageLayout
      sectionLabel={t("Sales & Billing")}
      pageTitle={t("Livestock Sales")}
      subtitle={t("Create and track livestock sales")}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-start">
        <Card className="min-w-0 shadow-sm">
          <CardHeader className="border-b pb-5">
            <CardTitle>{t("New livestock sale")}</CardTitle>
            <CardDescription>
              {t("Enter customer details, add livestock lines, then submit to record the sale.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <SaleFormSection
              divided={false}
              id="livestock-section-customer"
              title={t("Customer & payment")}
              icon={<UserRound className="size-4" />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="livestock-customer-name" label={t("Customer Name")}>
                  <Input
                    id="livestock-customer-name"
                    placeholder={t("Enter customer name")}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    autoComplete="name"
                  />
                </FormField>
                <FormField id="livestock-customer-contact" label={t("Contact")}>
                  <Input
                    id="livestock-customer-contact"
                    placeholder={t("Phone or email")}
                    value={customerContact}
                    onChange={(e) => setCustomerContact(e.target.value)}
                    autoComplete="tel"
                  />
                </FormField>
                <FormField
                  id="livestock-payment-method"
                  label={t("Payment method")}
                  className="sm:col-span-2"
                >
                  <PaymentMethodPicker
                    labelId="livestock-payment-method"
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    t={t}
                  />
                </FormField>
              </div>
            </SaleFormSection>

            <SaleFormSection
              id="livestock-section-lines"
              title={
                editingLineIndex !== null ? t("Edit livestock line") : t("Add livestock line")
              }
              description={t("Select an item, enter quantity and amount, then add to the sale.")}
            >
              <div className="grid gap-4">
                <FormField id="livestock-item-select" label={t("Livestock Item ID")}>
                  <select
                    id="livestock-item-select"
                    className="saleSelect"
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
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="livestock-quantity" label={t("Quantity")}>
                    <Input
                      id="livestock-quantity"
                      type="number"
                      min={0}
                      step="any"
                      value={livestockWeight}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setLivestockWeight(e.target.value)}
                      inputMode="decimal"
                    />
                  </FormField>
                  <FormField id="livestock-amount" label={t("Amount")}>
                    <Input
                      id="livestock-amount"
                      type="number"
                      min={0}
                      step="any"
                      value={livestockAmount || ""}
                      onChange={(e) => setLivestockAmount(Number(e.target.value) || 0)}
                      inputMode="decimal"
                    />
                  </FormField>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" className="gap-1.5" onClick={handleSaveLivestockLine}>
                    <Plus className="size-4" aria-hidden />
                    {editingLineIndex !== null ? t("Update line") : t("Add Livestock")}
                  </Button>
                  {editingLineIndex !== null ? (
                    <Button type="button" variant="ghost" onClick={cancelEditLivestockLine}>
                      {t("Cancel")}
                    </Button>
                  ) : null}
                </div>
              </div>
            </SaleFormSection>

            {livestockError ? (
              <Alert variant="destructive" className="mt-6">
                <AlertDescription>{livestockError}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-4">
          <Card className="shadow-sm">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">{t("Current sale")}</CardTitle>
                <CardDescription>{t("Lines in this sale")}</CardDescription>
              </div>
              {livestockLineItems.length > 0 ? (
                <Badge variant="success">{livestockLineItems.length}</Badge>
              ) : null}
            </CardHeader>
            <CardContent className="p-0 pt-0">
              <div className="saleTableWrap">
                <table className="saleTable saleTable--stack">
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
                      <tr className="saleTableRow--empty">
                        <td colSpan={6} className="saleTableEmpty">
                          <div className="saleEmptyState">
                            <p className="saleEmptyStateTitle">{t("No lines in this sale yet")}</p>
                            <p className="saleEmptyStateHint">
                              {t(
                                "Choose an item, quantity, and amount above, then use Add Livestock.",
                              )}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      livestockLineItems.map((item, index) => (
                        <tr
                          key={`${item.livestockItemId}-${index}`}
                          className={editingLineIndex === index ? "saleTableRow--editing" : undefined}
                        >
                          <td data-label={t("Name")}>{item.name}</td>
                          <td data-label={t("Contact")}>{item.contact}</td>
                          <td data-label={t("Livestock Item ID")}>{item.livestockItemLabel}</td>
                          <td data-label={t("Quantity")}>{item.weight}</td>
                          <td data-label={t("Amount")}>{item.amount}</td>
                          <td data-label={t("Actions")} className="saleTableCell--action">
                            <div className="saleLineActions">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="saleTableBtn h-8"
                                onClick={() => startEditLivestockLine(index)}
                              >
                                {t("Edit")}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="saleTableBtn h-8 text-destructive hover:text-destructive"
                                onClick={() => setLineIndexToDelete(index)}
                                disabled={editingLineIndex !== null && editingLineIndex !== index}
                              >
                                {t("Delete")}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {livestockLineItems.length > 0 ? (
                    <tfoot>
                      <tr className="saleTableFootRow">
                        <td colSpan={4} className="saleTotalLabel">
                          {t("Total")}
                        </td>
                        <td className="saleTotalValue saleTotalValue--emphasis">{livestockTotal}</td>
                        <td className="saleTableFootSpacer" aria-hidden />
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </CardContent>
            <CardFooter className="border-t bg-muted/20 pt-6">
              <Button
                type="button"
                className="h-11 w-full rounded-full text-base font-semibold"
                onClick={handleLivestockCheckout}
                disabled={createLivestockSaleMutation.isPending || livestockLineItems.length === 0}
              >
                {createLivestockSaleMutation.isPending
                  ? t("Processing…")
                  : t("Submit Livestock Sale")}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="border-b pb-4">
          <CardTitle>{t("Live Stock Sale Details")}</CardTitle>
          <CardDescription>{t("Recent livestock sales from your account.")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {livestockSalesLoading && <TableSkeleton rows={5} columns={6} />}
          {livestockSalesIsError && (
            <ErrorState
              title={t("Failed to load livestock sales")}
              description={
                livestockSalesErrorDetail instanceof Error
                  ? livestockSalesErrorDetail.message
                  : undefined
              }
            />
          )}
          {!livestockSalesLoading &&
            !livestockSalesIsError &&
            livestockSales.length === 0 && (
              <EmptyState title={t("No livestock sales yet.")} />
            )}
          {!livestockSalesLoading &&
            !livestockSalesIsError &&
            livestockSales.length > 0 && (
              <div className="saleTableWrap">
                <table className="saleTable saleTable--stack">
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
                    {livestockSales.map((sale: LivestockSale, index: number) => (
                      <tr
                        key={
                          sale.id ??
                          sale.transactionId ??
                          `${sale.livestockItemId ?? "item"}-${index}`
                        }
                      >
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
            )}

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{t("per page")}</span>
              <select
                id="livestock-page-size"
                className="saleSelect !w-auto min-w-[4.5rem]"
                value={salesListPageSize}
                disabled={livestockSalesLoading}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!Number.isFinite(next) || next <= 0) return;
                  setSalesListPageSize(next);
                  setSalesListPage(1);
                }}
                aria-label={t("Items per page")}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-sm text-muted-foreground">
              {t("Page")} {livestockPage?.page ?? salesListPage}
              {livestockPage?.hasMore ? ` · ${t("More pages available.")}` : ""}
            </span>
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={salesListPage <= 1 || livestockSalesLoading}
                onClick={() => setSalesListPage((p) => Math.max(1, p - 1))}
              >
                {t("Previous")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!livestockPage?.hasMore || livestockSalesLoading}
                onClick={() => setSalesListPage((p) => p + 1)}
              >
                {t("Next")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
    </SalePageLayout>
  );
}
