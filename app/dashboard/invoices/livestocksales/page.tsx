"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
  extractTransactionId,
  type LivestockSalePayload,
} from "@/handlers/sale";
import { createCreditorPayLater, type Creditor } from "@/handlers/creditor";
import {
  DEFAULT_SALE_PAYMENT_METHOD,
  isPayLaterSelection,
  paymentMethodLabel,
  resolveSalePaymentMethod,
  type SalePaymentSelection,
} from "@/lib/salePaymentMethods";
import { formatSaleAmount } from "@/lib/saleCalculations";
import ConfirmModal from "@/app/components/Modal/ConfirmModal";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { FormField } from "@/app/components/ui-ext/FormField";
import { PaymentMethodPicker } from "@/app/dashboard/invoices/components/PaymentMethodPicker";
import CreditorPicker from "@/app/dashboard/invoices/components/CreditorPicker";
import {
  SaleCartList,
  SaleFormSection,
  SaleSummary,
  type CartLineItem,
} from "@/app/dashboard/invoices/components/SaleSharedComponents";
import { SalePageLayout } from "@/app/dashboard/invoices/components/SalePageLayout";
import { SaleSelect } from "@/app/dashboard/invoices/components/SaleSelect";
import { Plus } from "lucide-react";
import { getCustomerTypes } from "@/handlers/customerType";
import { createCustomer, getCustomers, type Customer } from "@/handlers/customer";
import PosCustomerNameCombobox from "@/app/dashboard/invoices/new/PosCustomerNameCombobox";
import { findMatchingCustomer } from "@/app/dashboard/invoices/new/findMatchingCustomer";
import "../components/sale-entry.scss";

const LIVE_PRODUCT_TYPE_NAMES = ["live stock", "live"];
const PRODUCTS_QUERY_KEY = ["products"];
const PRODUCT_TYPES_QUERY_KEY = ["productTypes"];
const LIVESTOCK_ITEMS_QUERY_KEY = ["livestockItemsByProduct"];
const CUSTOMER_TYPES_QUERY_KEY = ["customerTypes"];
const CUSTOMERS_QUERY_KEY = ["customers"];

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
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerTypeId, setCustomerTypeId] = useState("");
  const [selectedLivestockItemId, setSelectedLivestockItemId] = useState("");
  const [livestockWeight, setLivestockWeight] = useState("");
  const [livestockAmount, setLivestockAmount] = useState<number>(0);
  const [livestockLineItems, setLivestockLineItems] = useState<LivestockLineItem[]>([]);
  const [livestockError, setLivestockError] = useState<string | null>(null);
  const [loadLivestockItems, setLoadLivestockItems] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentSelection>(
    DEFAULT_SALE_PAYMENT_METHOD
  );
  const [payLaterCreditor, setPayLaterCreditor] = useState<Creditor | null>(null);
  const [lineIndexToDelete, setLineIndexToDelete] = useState<number | null>(null);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);

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

  useEffect(() => {
    if (!customerTypeId && customerTypes.length > 0) {
      setCustomerTypeId(customerTypes[0].id);
    }
  }, [customerTypeId, customerTypes]);

  const applyRegisteredCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerContact(customer.contact);
    if (customer.customerTypeId) setCustomerTypeId(customer.customerTypeId);
  };

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
    mutationFn: async (payload: {
      items: LivestockSalePayload[];
      payLater: {
        creditorId: string;
        items: Array<{
          livestockItemId: string;
          name: string;
          quantity: number;
          amount: number;
        }>;
        totalAmount: number;
      } | null;
      customerCreate: {
        name: string;
        contact: string;
        outletId: string;
        customerTypeId: string;
      } | null;
    }) => {
      const saleResult = await createLivestockSale(payload.items);
      if (!saleResult.ok) {
        return {
          saleOk: false as const,
          error: saleResult.error,
          status: saleResult.status,
          payLaterError: null as string | null,
        };
      }

      let payLaterError: string | null = null;
      if (payload.payLater) {
        const sourceTransactionId = extractTransactionId(saleResult.data);
        if (!sourceTransactionId) {
          payLaterError = t(
            "Sale created, but pay-later could not be linked: no transaction id was returned."
          );
        } else {
          const payLaterResult = await createCreditorPayLater({
            creditorId: payload.payLater.creditorId,
             outletId: products.find((product) => product.id === payload.items[0]?.livestockItemId)?.outletId ?? "",
            sourceType: "LIVESTOCK",
            sourceTransactionId,
            items: payload.payLater.items,
            totalAmount: payload.payLater.totalAmount,
          });
          if (!payLaterResult.ok) {
            payLaterError = payLaterResult.error;
          }
        }
      }
      let customerCreateError: string | null = null;
      let customerCreated = false;
      if (payload.customerCreate) {
        const customerResult = await createCustomer(payload.customerCreate);
        if (customerResult.ok) customerCreated = true;
        else customerCreateError = customerResult.error;
      }
      return {
        saleOk: true as const,
        payLaterError,
        customerCreateError,
        customerCreated,
      };
    },
    onSuccess: (result, variables) => {
      if (!result.saleOk) {
        if (result.status === 401) navigate("/login");
        else {
          setLivestockError(result.error);
          showToast(result.error, "error");
        }
        return;
      }

      if (result.payLaterError) {
        showToast(result.payLaterError, "error");
      } else if (variables.payLater) {
        showToast(t("Livestock sale created successfully."), "success");
      } else {
        showToast(t("Livestock sale created successfully."), "success");
      }
      if (result.customerCreateError) {
        showToast(
          `${t("Sale created, but customer could not be saved.")} ${result.customerCreateError}`,
          "error"
        );
      }

      setLivestockLineItems([]);
      setCustomerName("");
      setCustomerContact("");
      setSelectedCustomerId("");
      setCustomerTypeId(customerTypes[0]?.id ?? "");
      clearLivestockLineForm();
      setPaymentMethod(DEFAULT_SALE_PAYMENT_METHOD);
      setPayLaterCreditor(null);
      setLivestockError(null);
      queryClient.invalidateQueries({ queryKey: ["livestockSales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSales"] });
      queryClient.invalidateQueries({ queryKey: ["loyalty"] });
      if (result.customerCreated) {
        queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY });
      }
      if (variables.payLater) {
        queryClient.invalidateQueries({ queryKey: ["creditors"] });
        queryClient.invalidateQueries({
          queryKey: ["creditor", variables.payLater.creditorId],
        });
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
    if (isPayLaterSelection(paymentMethod) && !payLaterCreditor?.id) {
      setLivestockError(t("Select a creditor for Pay Later."));
      return;
    }
    setLivestockError(null);

    const effectivePaymentMethod = resolveSalePaymentMethod(paymentMethod);
    const isPayLater = isPayLaterSelection(paymentMethod) && Boolean(payLaterCreditor?.id);
    const payLater =
      isPayLater && payLaterCreditor
        ? {
            creditorId: payLaterCreditor.id,
            items: livestockLineItems.map((item) => ({
              livestockItemId: item.livestockItemId,
              name: item.livestockItemLabel,
              quantity: item.weight,
              amount: item.weight * item.amount,
            })),
            totalAmount: livestockTotal,
          }
        : null;

    const firstLine = livestockLineItems[0];
    const livestockItem = firstLine
      ? livestockItems.find((item) => resolveLivestockItemId(item) === firstLine.livestockItemId)
      : null;
    const outletId = livestockItem
      ? products.find((product) => product.id === livestockItem.productId)?.outletId ?? ""
      : "";
    const existingCustomer = firstLine && outletId
      ? Boolean(selectedCustomerId) ||
        findMatchingCustomer(allCustomers, {
          name: firstLine.name,
          contact: firstLine.contact,
          outletId,
        }) != null
      : true;
    const customerCreate =
      firstLine && outletId && customerTypeId && !existingCustomer
        ? {
            name: firstLine.name,
            contact: firstLine.contact,
            outletId,
            customerTypeId,
          }
        : null;

    createLivestockSaleMutation.mutate({
      items: livestockLineItems.map((item) => ({
        name: item.name,
        contact: item.contact,
        livestockItemId: item.livestockItemId,
        itemQuantityOrWeight: item.weight,
        amount: item.amount,
        paymentMethod: effectivePaymentMethod,
      })),
      payLater,
      customerCreate,
    });
  };

  const livestockTotal = livestockLineItems.reduce(
    (sum, item) => sum + item.weight * item.amount,
    0
  );

  const cartItems: CartLineItem[] = livestockLineItems.map((item, index) => ({
    id: `${item.livestockItemId}-${index}`,
    primary: item.livestockItemLabel,
    detail: `${t("Qty")}: ${item.weight}`,
    amount: formatSaleAmount(item.amount),
    editing: editingLineIndex === index,
  }));

  const paymentDisplay = isPayLaterSelection(paymentMethod)
    ? `${t("Pay Later")}${payLaterCreditor?.name ? ` — ${payLaterCreditor.name}` : ""}`
    : t(paymentMethodLabel(paymentMethod));

  const summaryRows = [
    { label: t("Lines"), value: String(livestockLineItems.length) },
    { label: t("Payment"), value: paymentDisplay },
  ];

  return (
    <SalePageLayout
      sectionLabel={t("Sales & Billing")}
      pageTitle={t("Livestock Sales")}
      subtitle={t("Create and track livestock sales")}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:items-start">
        <Card className="min-w-0 shadow-sm">
          <CardContent className="pt-4">
            <SaleFormSection
              divided={false}
              compact
              id="livestock-section-customer"
              title={t("Customer & payment")}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="livestock-customer-name" label={t("Customer Name")}>
                  <PosCustomerNameCombobox
                    id="livestock-customer-name"
                    customers={allCustomers}
                    value={customerName}
                    onChange={(value) => {
                      setSelectedCustomerId("");
                      setCustomerTypeId(customerTypes[0]?.id ?? "");
                      setCustomerName(value);
                    }}
                    onSelectCustomer={applyRegisteredCustomer}
                    t={t}
                  />
                </FormField>
                <FormField id="livestock-customer-contact" label={t("Contact")}>
                  <Input
                    id="livestock-customer-contact"
                    placeholder={t("Phone or email")}
                    value={customerContact}
                    onChange={(e) => {
                      setSelectedCustomerId("");
                      setCustomerTypeId(customerTypes[0]?.id ?? "");
                      setCustomerContact(e.target.value);
                    }}
                    autoComplete="tel"
                  />
                </FormField>
                <FormField id="livestock-payment-method" label={t("Payment method")}>
                  <PaymentMethodPicker
                    labelId="livestock-payment-method"
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    t={t}
                    allowPayLater
                  />
                </FormField>
              </div>
              {isPayLaterSelection(paymentMethod) ? (
                <FormField id="livestock-creditor" label={t("Creditor")} required>
                  <CreditorPicker
                    id="livestock-creditor"
                    value={payLaterCreditor?.id ?? ""}
                    onChange={setPayLaterCreditor}
                    t={t}
                  />
                </FormField>
              ) : null}
            </SaleFormSection>

            <SaleFormSection
              compact
              id="livestock-section-lines"
              title={
                editingLineIndex !== null ? t("Edit livestock line") : t("Add livestock line")
              }
            >
              <div className="grid gap-3">
                <FormField id="livestock-item-select" label={t("Livestock Item ID")}>
                  <SaleSelect
                    id="livestock-item-select"
                    value={selectedLivestockItemId}
                    onChange={setSelectedLivestockItemId}
                    onOpenChange={(open) => {
                      if (open) setLoadLivestockItems(true);
                    }}
                    placeholder={t("Select livestock item")}
                    options={livestockOptions}
                  />
                </FormField>
                <div className="grid gap-3 sm:grid-cols-2">
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
                  <Button type="button" variant="outline" onClick={handleSaveLivestockLine}>
                    <Plus data-icon="inline-start" aria-hidden />
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
              <Alert variant="destructive" className="mt-3">
                <AlertDescription>{livestockError}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 lg:sticky lg:top-4">
          <Card className="shadow-sm">
            <CardHeader className="flex-row items-center justify-between gap-0 pb-2">
              <h3 className="text-sm font-semibold">{t("Current sale")}</h3>
              {livestockLineItems.length > 0 ? (
                <Badge variant="success">{livestockLineItems.length}</Badge>
              ) : null}
            </CardHeader>
            <CardContent className="pt-0">
              <SaleCartList
                items={cartItems}
                emptyTitle={t("No lines in this sale yet")}
                emptyHint={t("Choose an item, quantity, and amount above, then use Add Livestock.")}
                onEdit={startEditLivestockLine}
                onDelete={(index) => setLineIndexToDelete(index)}
                editLabel={t("Edit")}
                deleteLabel={t("Delete")}
              />
              {livestockLineItems.length > 0 ? (
                <SaleSummary
                  className="mt-3"
                  rows={summaryRows}
                  totalLabel={t("Total due")}
                  totalValue={formatSaleAmount(livestockTotal)}
                />
              ) : null}
            </CardContent>
            <CardFooter className="border-t bg-muted/20 pt-4">
              <Button
                type="button"
                size="xl"
                className="w-full text-base font-semibold"
                onClick={handleLivestockCheckout}
                disabled={createLivestockSaleMutation.isPending || livestockLineItems.length === 0}
              >
                {createLivestockSaleMutation.isPending ? (
                  <svg className="animate-spin size-4 mr-2" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : null}
                {createLivestockSaleMutation.isPending
                  ? t("Processing...")
                  : t("Submit Livestock Sale")}
              </Button>
            </CardFooter>
          </Card>
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
    </SalePageLayout>
  );
}
