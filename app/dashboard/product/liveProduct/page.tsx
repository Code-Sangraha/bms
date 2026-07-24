"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, MoreHorizontal, Plus } from "lucide-react";
import { useI18n } from "@/app/providers/I18nProvider";
import { useAuth, usePermissions } from "@/app/providers/AuthProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import { PageHeader } from "@/app/components/ui-ext/PageHeader";
import { DataTable, type DataTableColumn } from "@/app/components/ui-ext/DataTable";
import ConfirmDialog from "@/app/components/ui-ext/ConfirmDialog";
import ResponsiveOverlay from "@/app/components/ui-ext/ResponsiveOverlay";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import {
  clearLivestockItemsCache,
  createLivestockItem,
  deductLivestockItem,
  deleteLivestockItem,
  getLivestockCategories,
  getLivestockInventoryHistory,
  getLivestockItemsByProduct,
  resolveLivestockDeleteKey,
  resolveLivestockItemId,
  restockLivestockItem,
  updateLivestockItem,
  type LivestockItem,
  type LivestockRestockPayload,
} from "@/handlers/product";
import { computeDueAmount, derivePaymentStatus } from "@/lib/billing/paymentStatus";
import { livestockRestockDetailSchema } from "@/schema/livestockDetailModals";
import type { LivestockDetailLocationState } from "@/app/dashboard/product/lib/inventoryDetailTypes";
import OpeningStockTable from "./components/OpeningStockTable";
import ClosingStockTable from "./components/ClosingStockTable";
import SupplierPicker from "./SupplierPicker";
import {
  buildLivestockOpeningStockData,
  type LivestockClientStockMode,
} from "./lib/buildLivestockOpeningStockData";
import "./openingClosingStock.scss";

const LIVESTOCK_CATEGORY_QUERY_KEY = ["livestockCategories"];
const LIVESTOCK_ITEMS_QUERY_KEY = ["livestockItemsByProduct"];

type LivestockFormState = {
  productId: string;
  name: string;
  itemId: string;
  weight: string;
  buyingPrice: string;
  sellingPrice: string;
  status: "Active" | "Inactive";
  supplierId: string;
  supplierName: string;
  supplierContact: string;
};

const defaultLivestockForm: LivestockFormState = {
  productId: "",
  name: "",
  itemId: "",
  weight: "",
  buyingPrice: "",
  sellingPrice: "",
  status: "Active",
  supplierId: "",
  supplierName: "",
  supplierContact: "",
};

type StockAdjustModalState = { item: LivestockItem; mode: "restock" | "deduct" } | null;

type LiveProductMainTab = "inventory" | "openingClosing";

function resolveLivestockRowActionKey(item: LivestockItem, index: number): string {
  const withUnderscore = item as unknown as { _id?: unknown };
  if (typeof item.id === "string" && item.id) return `id:${item.id}`;
  if (typeof withUnderscore._id === "string" && withUnderscore._id) return `_id:${withUnderscore._id}`;
  return `fallback:${item.productId}:${item.itemId}:${index}`;
}

function resolveLivestockOutletId(item: LivestockItem): string {
  const row = item as { outletId?: unknown; outlet?: { id?: unknown } };
  if (typeof row.outletId === "string" && row.outletId.trim()) return row.outletId.trim();
  if (row.outlet && typeof row.outlet.id === "string" && row.outlet.id.trim()) return row.outlet.id.trim();
  return "";
}

function priceFieldToString(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

function parsePriceFieldForSubmit(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function hasInvalidOptionalPriceField(raw: string): boolean {
  const t = raw.trim();
  if (t === "") return false;
  const n = Number(t);
  return !Number.isFinite(n) || n <= 0;
}

function toFormState(item: LivestockItem): LivestockFormState {
  return {
    productId: item.productId,
    name: item.name ?? "",
    itemId: item.itemId ?? "",
    weight: item.weight != null ? String(item.weight) : "",
    buyingPrice: priceFieldToString(item.buyingPrice),
    sellingPrice: priceFieldToString(item.sellingPrice),
    status: item.status ? "Active" : "Inactive",
    supplierId: "",
    supplierName: "",
    supplierContact: "",
  };
}

function toNormalizedItem(item: LivestockItem): LivestockItem {
  const id = resolveLivestockItemId(item);
  return {
    ...item,
    ...(id ? { id } : {}),
  };
}

function formatLivestockTableQuantity(item: LivestockItem): string {
  if (typeof item.quantity === "number" && Number.isFinite(item.quantity)) {
    return String(item.quantity);
  }
  return "—";
}

function formatLivestockPriceCell(value: number | null | undefined): string {
  if (value != null && Number.isFinite(value)) {
    return value.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return "—";
}

function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localCalendarDayFromCreatedAt(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) {
    const s = iso.trim();
    return s.length >= 10 ? s.slice(0, 10) : s;
  }
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shouldLogLivestockOpeningStockDebug(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV) return true;
  try {
    return window.localStorage.getItem("DEBUG_LIVESTOCK_STOCK") === "1";
  } catch {
    return false;
  }
}

export default function LiveProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { capabilities } = usePermissions();
  const { userOutletId } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [isLivestockModalOpen, setIsLivestockModalOpen] = useState(false);
  const [isEditLivestockModalOpen, setIsEditLivestockModalOpen] = useState(false);
  const [livestockError, setLivestockError] = useState<string | null>(null);
  const [editLivestockError, setEditLivestockError] = useState<string | null>(null);
  const [rowActionError, setRowActionError] = useState<string | null>(null);
  const [livestockForm, setLivestockForm] = useState<LivestockFormState>(defaultLivestockForm);
  const [editLivestockForm, setEditLivestockForm] = useState<LivestockFormState>(defaultLivestockForm);
  const [editingLivestockId, setEditingLivestockId] = useState<string | null>(null);
  const [stockAdjustModal, setStockAdjustModal] = useState<StockAdjustModalState>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [stockAdjustError, setStockAdjustError] = useState<string | null>(null);
  const [restockSupplierName, setRestockSupplierName] = useState("");
  const [restockSupplierContact, setRestockSupplierContact] = useState("");
  const [restockSupplierId, setRestockSupplierId] = useState("");
  const [restockBuyingPrice, setRestockBuyingPrice] = useState("");
  const [restockSellingPrice, setRestockSellingPrice] = useState("");
  const [restockTotalAmount, setRestockTotalAmount] = useState("");
  const [restockPaidAmount, setRestockPaidAmount] = useState("");
  const [restockRemarks, setRestockRemarks] = useState("");
  const [itemPendingDelete, setItemPendingDelete] = useState<LivestockItem | null>(null);
  const [mainTab, setMainTab] = useState<LiveProductMainTab>("inventory");

  const [openingStockFrom, setOpeningStockFrom] = useState(() => toIsoDateLocal(new Date()));
  const [openingStockTo, setOpeningStockTo] = useState(() => toIsoDateLocal(new Date()));
  const openingStockRangeInvalid = openingStockFrom > openingStockTo;

  const {
    data: livestockCategories = [],
    isLoading: categoryLoading,
    isError: categoryError,
  } = useQuery({
    queryKey: LIVESTOCK_CATEGORY_QUERY_KEY,
    retry: 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const result = await getLivestockCategories();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const liveStockProductIds = useMemo(
    () => livestockCategories.map((category) => category.id).sort(),
    [livestockCategories]
  );

  const refreshLivestockItems = useCallback(() => {
    clearLivestockItemsCache();
    void queryClient.invalidateQueries({ queryKey: [...LIVESTOCK_ITEMS_QUERY_KEY, liveStockProductIds] });
  }, [queryClient, liveStockProductIds]);

  const {
    data: livestockItems = [],
    isLoading: livestockItemsLoading,
    isError: livestockItemsError,
  } = useQuery({
    queryKey: [...LIVESTOCK_ITEMS_QUERY_KEY, liveStockProductIds],
    enabled: liveStockProductIds.length > 0,
    retry: 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const results = await Promise.all(
        liveStockProductIds.map((productId) => getLivestockItemsByProduct(productId))
      );
      const merged: LivestockItem[] = [];
      const errors: string[] = [];
      for (const result of results) {
        if (!result.ok) {
          if (result.status === 401) navigate("/login");
          if (result.status === 400 || result.status === 404) {
            continue;
          }
          errors.push(result.error);
          continue;
        }
        merged.push(...result.data.map(toNormalizedItem));
      }
      if (errors.length > 0 && merged.length === 0) {
        throw new Error(errors[0]);
      }
      const seen = new Set<string>();
      return merged.filter((item) => {
        const key = resolveLivestockItemId(item) ?? `${item.productId}-${item.itemId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  });

  const filteredLivestockItems = useMemo(() => {
    const categoryFiltered =
      selectedCategoryId === "all"
        ? livestockItems
        : livestockItems.filter((item) => item.productId === selectedCategoryId);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categoryFiltered;
    return categoryFiltered.filter((item) => {
      const productName =
        livestockCategories.find((product) => product.id === item.productId)?.name.toLowerCase() ?? "";
      const qtySearch =
        typeof item.quantity === "number" && Number.isFinite(item.quantity) ? String(item.quantity) : "";
      const buySearch =
        item.buyingPrice != null && Number.isFinite(item.buyingPrice) ? String(item.buyingPrice) : "";
      const sellSearch =
        item.sellingPrice != null && Number.isFinite(item.sellingPrice) ? String(item.sellingPrice) : "";
      return (
        item.name.toLowerCase().includes(q) ||
        item.itemId.toLowerCase().includes(q) ||
        qtySearch.includes(q) ||
        String(item.weight).includes(q) ||
        buySearch.includes(q) ||
        sellSearch.includes(q) ||
        productName.includes(q)
      );
    });
  }, [livestockItems, livestockCategories, searchQuery, selectedCategoryId]);

  const todayIso = toIsoDateLocal(new Date());
  const clientStockMode: LivestockClientStockMode =
    openingStockTo === todayIso ? "reconciled" : "movementOnly";

  const {
    data: livestockHistoryForOpeningStock = [],
    isPending: livestockHistoryOpeningStockPending,
    isError: livestockHistoryOpeningStockError,
    error: livestockHistoryOpeningStockErrorDetail,
  } = useQuery({
    queryKey: [
      "livestockInventoryHistory",
      "openingClosingRange",
      openingStockFrom,
      openingStockTo,
      clientStockMode,
      liveStockProductIds.join(","),
    ],
    enabled:
      mainTab === "openingClosing" &&
      !openingStockRangeInvalid &&
      liveStockProductIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const todayLocal = toIsoDateLocal(new Date());
      const toDate = clientStockMode === "reconciled" ? todayLocal : openingStockTo;
      const result = await getLivestockInventoryHistory({
        fromDate: openingStockFrom,
        toDate,
      });
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const clientLivestockOpeningStockData = useMemo(
    () =>
      buildLivestockOpeningStockData({
        from: openingStockFrom,
        to: openingStockTo,
        items: filteredLivestockItems,
        history: livestockHistoryForOpeningStock,
        categories: livestockCategories,
        mode: clientStockMode,
      }),
    [
      openingStockFrom,
      openingStockTo,
      filteredLivestockItems,
      livestockHistoryForOpeningStock,
      livestockCategories,
      clientStockMode,
    ]
  );

  const openingStockPending =
    livestockHistoryOpeningStockPending || (livestockItemsLoading && mainTab === "openingClosing");
  const openingStockError = livestockHistoryOpeningStockError;
  const openingStockErrorMessage = openingStockError
    ? livestockHistoryOpeningStockErrorDetail instanceof Error &&
      livestockHistoryOpeningStockErrorDetail.message.trim()
      ? livestockHistoryOpeningStockErrorDetail.message
      : t("Opening stock data is not available yet.")
    : null;

  useEffect(() => {
    if (!shouldLogLivestockOpeningStockDebug()) return;
    if (mainTab !== "openingClosing") return;
    if (openingStockRangeInvalid) return;

    const toDateSent =
      clientStockMode === "reconciled" ? toIsoDateLocal(new Date()) : openingStockTo;

    const hist = livestockHistoryForOpeningStock;
    const historyRowsInUiRange = hist.filter((h) => {
      const day = localCalendarDayFromCreatedAt(h.createdAt);
      return day >= openingStockFrom && day <= openingStockTo;
    });

    console.groupCollapsed("[livestock-opening-stock] filters & API request");
    console.log("UI date range (what the tables use)", {
      from: openingStockFrom,
      to: openingStockTo,
      clientStockMode,
    });
    console.log("GET /products/livestock/history body", {
      fromDate: openingStockFrom,
      toDate: toDateSent,
      note:
        clientStockMode === "reconciled"
          ? "toDate is extended to today so post-range rows can anchor closing."
          : "toDate matches UI end date.",
    });
    console.log("Inventory filter", {
      filteredRowCount: filteredLivestockItems.length,
      categoryId: selectedCategoryId,
      searchQuery: searchQuery.trim() || "(empty)",
    });
    console.log("Fetch state", {
      pending: livestockHistoryOpeningStockPending,
      error: livestockHistoryOpeningStockError,
    });
    console.groupEnd();

    if (livestockHistoryOpeningStockPending || livestockHistoryOpeningStockError) {
      console.log("[livestock-opening-stock] skip row dump (still loading or error)");
      return;
    }

    console.groupCollapsed("[livestock-opening-stock] raw history (" + hist.length + " rows)");
    console.table(
      hist.map((h) => ({
        livestockItemId: h.livestockItemId,
        type: h.type,
        quantity: h.quantity,
        weight: h.weight,
        createdAt: h.createdAt,
        localDay: localCalendarDayFromCreatedAt(h.createdAt),
        inUiRange:
          localCalendarDayFromCreatedAt(h.createdAt) >= openingStockFrom &&
          localCalendarDayFromCreatedAt(h.createdAt) <= openingStockTo
            ? "yes"
            : "no",
      }))
    );
    console.log("Rows whose localDay falls inside [from, to]", historyRowsInUiRange.length, "of", hist.length);
    if (hist.length > 0 && historyRowsInUiRange.length === 0) {
      console.warn(
        "[livestock-opening-stock] API returned " +
          hist.length +
          " rows but none fall on a local calendar day in [" +
          openingStockFrom +
          " … " +
          openingStockTo +
          "]. Movement totals for that range stay 0. Check: backend date filter, timezone vs createdAt, and rows with null quantity/weight (count as 0)."
      );
    }
    console.groupEnd();

    console.groupCollapsed(
      "[livestock-opening-stock] built openingStockByDate (" +
        clientLivestockOpeningStockData.openingStockByDate.length +
        " days)"
    );
    console.table(
      clientLivestockOpeningStockData.openingStockByDate.map((d) => ({
        date: d.date,
        totalAdded: d.totalAdded,
        totalConsumed: d.totalConsumed,
        totalOpening: d.totalOpening,
        totalClosing: d.totalClosing,
        itemCount: d.items.length,
      }))
    );
    console.groupEnd();
  }, [
    mainTab,
    openingStockRangeInvalid,
    openingStockFrom,
    openingStockTo,
    clientStockMode,
    livestockHistoryForOpeningStock,
    livestockHistoryOpeningStockPending,
    livestockHistoryOpeningStockError,
    filteredLivestockItems,
    selectedCategoryId,
    searchQuery,
    clientLivestockOpeningStockData,
  ]);

  const orderedLivestockItems = useMemo(() => {
    const toTimestamp = (item: LivestockItem): number => {
      const candidate =
        item.createdAt ??
        item.updatedAt ??
        (item as { created_at?: unknown }).created_at ??
        (item as { date?: unknown }).date;
      if (typeof candidate !== "string" || !candidate) return Number.POSITIVE_INFINITY;
      const ts = new Date(candidate).getTime();
      return Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY;
    };

    return filteredLivestockItems
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const diff = toTimestamp(a.item) - toTimestamp(b.item);
        if (diff !== 0) return diff;
        return a.index - b.index;
      })
      .map((row) => row.item);
  }, [filteredLivestockItems]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(orderedLivestockItems.length, { defaultPageSize: 10 });

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategoryId, searchQuery, setCurrentPage]);

  const paginatedLivestockItems = useMemo(
    () => paginate(orderedLivestockItems, startIndex, endIndex),
    [orderedLivestockItems, startIndex, endIndex]
  );

  const getLiveProductName = (productId: string) =>
    livestockCategories.find((product) => product.id === productId)?.name ?? productId;

  const livestockMutation = useMutation({
    mutationFn: createLivestockItem,
    onSuccess: (result) => {
      setLivestockError(null);
      if (!result.ok) {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        setLivestockError(result.error ?? t("Failed to add live stock item"));
        return;
      }
      setIsLivestockModalOpen(false);
      setLivestockForm(defaultLivestockForm);
      refreshLivestockItems();
    },
    onError: () => {
      setLivestockError(t("Something went wrong. Please try again."));
    },
  });

  const restockLivestockMutation = useMutation({
    mutationFn: restockLivestockItem,
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        setStockAdjustError(result.error ?? t("Failed to restock livestock item."));
        return;
      }
      setStockAdjustError(null);
      setStockAdjustModal(null);
      setAdjustAmount("");
      refreshLivestockItems();
      void queryClient.invalidateQueries({ queryKey: ["livestockInventoryHistory"] });
      void queryClient.invalidateQueries({ queryKey: ["livestockExpenseHistory"] });
    },
    onError: () => {
      setStockAdjustError(t("Something went wrong. Please try again."));
    },
  });

  const deductLivestockMutation = useMutation({
    mutationFn: deductLivestockItem,
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        setStockAdjustError(result.error ?? t("Failed to deduct livestock item."));
        return;
      }
      setStockAdjustError(null);
      setStockAdjustModal(null);
      setAdjustAmount("");
      refreshLivestockItems();
      void queryClient.invalidateQueries({ queryKey: ["livestockInventoryHistory"] });
    },
    onError: () => {
      setStockAdjustError(t("Something went wrong. Please try again."));
    },
  });

  const deleteLivestockMutation = useMutation({
    mutationFn: (deleteKey: string) => deleteLivestockItem({ productId: deleteKey }),
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        setRowActionError(result.error ?? t("Failed to delete live stock item"));
        return;
      }
      setRowActionError(null);
      setItemPendingDelete(null);
      refreshLivestockItems();
    },
    onError: () => {
      setRowActionError(t("Something went wrong. Please try again."));
    },
  });

  const updateLivestockMutation = useMutation({
    mutationFn: updateLivestockItem,
    onSuccess: (result) => {
      setEditLivestockError(null);
      if (!result.ok) {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        setEditLivestockError(result.error ?? t("Failed to update live stock item"));
        return;
      }
      setIsEditLivestockModalOpen(false);
      setEditingLivestockId(null);
      setEditLivestockForm(defaultLivestockForm);
      refreshLivestockItems();
    },
    onError: () => {
      setEditLivestockError(t("Something went wrong. Please try again."));
    },
  });

  const validateLivestockForm = (
    form: LivestockFormState,
    setError: (message: string | null) => void
  ) => {
    const trimmedName = form.name.trim();
    const weight = Number(form.weight);
    const buyingPrice = parsePriceFieldForSubmit(form.buyingPrice);
    const sellingPrice = parsePriceFieldForSubmit(form.sellingPrice);

    if (!form.productId) return setError(t("Please select live stock product category.")), null;
    const trimmedItemId = form.itemId.trim();
    if (!trimmedItemId) return setError(t("Item ID is required.")), null;
    if (!trimmedName) return setError(t("Name is required.")), null;
    if (!Number.isFinite(weight) || weight <= 0) return setError(t("Quantity must be greater than 0.")), null;
    if (form.buyingPrice.trim() === "") {
      return setError(t("Buying price is required.")), null;
    }
    if (form.sellingPrice.trim() === "") {
      return setError(t("Selling price is required.")), null;
    }
    if (buyingPrice === null) {
      return setError(t("Buying price must be greater than 0.")), null;
    }
    if (sellingPrice === null) {
      return setError(t("Selling price must be greater than 0.")), null;
    }

    setError(null);
    return {
      productId: form.productId,
      name: trimmedName,
      itemId: trimmedItemId,
      quantity: weight,
      buyingPrice,
      sellingPrice,
      status: true,
      supplierId: form.supplierId || undefined,
      supplierName: form.supplierName.trim() || undefined,
      supplierContact: form.supplierContact.trim() || undefined,
    };
  };

  const handleSubmitLivestock = () => {
    if (!livestockForm.supplierId) {
      setLivestockError(t("Select or create a supplier."));
      return;
    }
    const payload = validateLivestockForm(livestockForm, setLivestockError);
    if (!payload) return;
    livestockMutation.mutate(payload);
  };

  const handleOpenEdit = (item: LivestockItem) => {
    const id = resolveLivestockItemId(item);
    if (!id) {
      setRowActionError(t("Unable to edit this row because item ID is missing from API response."));
      return;
    }
    setEditingLivestockId(id);
    setEditLivestockForm(toFormState(item));
    setEditLivestockError(null);
    setRowActionError(null);
    setIsEditLivestockModalOpen(true);
  };

  const handleSubmitEditLivestock = () => {
    if (!editingLivestockId) return;
    const sourceItem = livestockItems.find((row) => resolveLivestockItemId(row) === editingLivestockId);
    const outletId = sourceItem ? resolveLivestockOutletId(sourceItem) : "";
    const stableItemId = (sourceItem?.itemId ?? "").trim();
    const trimmedName = editLivestockForm.name.trim();
    const weight = Number(editLivestockForm.weight);
    const buyingPrice = parsePriceFieldForSubmit(editLivestockForm.buyingPrice);
    const sellingPrice = parsePriceFieldForSubmit(editLivestockForm.sellingPrice);

    if (!editLivestockForm.productId) return setEditLivestockError(t("Please select live stock product category."));
    if (!trimmedName) return setEditLivestockError(t("Name is required."));
    if (!stableItemId) return setEditLivestockError(t("Item ID is required."));
    if (!Number.isFinite(weight) || weight <= 0) return setEditLivestockError(t("Quantity must be greater than 0."));
    if (editLivestockForm.buyingPrice.trim() !== "" && buyingPrice === null) {
      return setEditLivestockError(t("Buying price must be greater than 0 when provided."));
    }
    if (editLivestockForm.sellingPrice.trim() !== "" && sellingPrice === null) {
      return setEditLivestockError(t("Selling price must be greater than 0 when provided."));
    }

    setEditLivestockError(null);
    updateLivestockMutation.mutate({
      id: editingLivestockId,
      name: trimmedName,
      itemId: stableItemId,
      productId: editLivestockForm.productId,
      outletId,
      itemQuantityOrWeight: weight,
      buyingPrice,
      sellingPrice,
      status: editLivestockForm.status === "Active",
    });
  };

  const openStockAdjustModal = (item: LivestockItem, mode: "restock" | "deduct") => {
    const id = resolveLivestockItemId(item);
    if (!id) {
      setRowActionError(t("Unable to adjust this row because item ID is missing from API response."));
      return;
    }
    setRowActionError(null);
    setStockAdjustError(null);
    setStockAdjustModal({ item, mode });
    setAdjustAmount("");
    setRestockSupplierName("");
    setRestockSupplierContact("");
    setRestockSupplierId("");
    setRestockSupplierId("");
    setRestockBuyingPrice(
      mode === "restock" ? priceFieldToString(item.buyingPrice) : ""
    );
    setRestockSellingPrice(
      mode === "restock" ? priceFieldToString(item.sellingPrice) : ""
    );
    setRestockTotalAmount("");
    setRestockPaidAmount("");
    setRestockRemarks("");
  };

  const closeStockAdjustModal = () => {
    setStockAdjustModal(null);
    setAdjustAmount("");
    setStockAdjustError(null);
    setRestockSupplierName("");
    setRestockSupplierContact("");
    setRestockBuyingPrice("");
    setRestockSellingPrice("");
    setRestockTotalAmount("");
    setRestockPaidAmount("");
    setRestockRemarks("");
  };

  const handleSubmitStockAdjust = () => {
    if (!stockAdjustModal) return;
    const id = resolveLivestockItemId(stockAdjustModal.item);
    if (!id) {
      setStockAdjustError(t("Unable to adjust this row because item ID is missing from API response."));
      return;
    }
    const amount = Number(adjustAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      setStockAdjustError(t("Quantity must be a whole number greater than 0."));
      return;
    }
    setStockAdjustError(null);
    if (stockAdjustModal.mode === "restock") {
      if (!restockSupplierId) {
        setStockAdjustError(t("Select or create a supplier."));
        return;
      }
      if (restockBuyingPrice.trim() === "") {
        setStockAdjustError(t("Buying price is required."));
        return;
      }
      if (restockSellingPrice.trim() === "") {
        setStockAdjustError(t("Selling price is required."));
        return;
      }
      if (hasInvalidOptionalPriceField(restockBuyingPrice)) {
        setStockAdjustError(t("Buying price must be greater than 0."));
        return;
      }
      if (hasInvalidOptionalPriceField(restockSellingPrice)) {
        setStockAdjustError(t("Selling price must be greater than 0."));
        return;
      }
      const buyingPrice = parsePriceFieldForSubmit(restockBuyingPrice);
      const sellingPrice = parsePriceFieldForSubmit(restockSellingPrice);
      const parsed = livestockRestockDetailSchema.safeParse({
        quantity: amount,
        buyingPrice: restockBuyingPrice,
        sellingPrice: restockSellingPrice,
        supplierName: restockSupplierName,
        supplierContact: restockSupplierContact || undefined,
        totalAmount: restockTotalAmount,
        paidAmount: restockPaidAmount,
        remarks: restockRemarks || undefined,
      });
      if (!parsed.success) {
        const first = parsed.error.issues[0]?.message ?? t("Please fill in all required fields.");
        setStockAdjustError(first);
        return;
      }
      const total = parsed.data.totalAmount;
      const paid = parsed.data.paidAmount;
      const payload: LivestockRestockPayload = {
        livestockItemId: id,
        quantity: amount,
        supplierName: parsed.data.supplierName,
        supplierId: restockSupplierId || undefined,
        totalAmount: total,
        paidAmount: paid,
        dueAmount: computeDueAmount(total, paid),
        paymentStatus: derivePaymentStatus(total, paid),
      };
      if (buyingPrice != null) payload.buyingPrice = buyingPrice;
      if (sellingPrice != null) payload.sellingPrice = sellingPrice;
      if (parsed.data.supplierContact) payload.supplierContact = parsed.data.supplierContact;
      if (parsed.data.remarks) payload.remarks = parsed.data.remarks;
      restockLivestockMutation.mutate(payload);
    } else {
      deductLivestockMutation.mutate({ livestockItemId: id, quantity: amount });
    }
  };

  const requestDeleteItem = (item: LivestockItem) => {
    const deleteKey = resolveLivestockDeleteKey(item);
    if (!deleteKey) {
      setRowActionError(
        t("Unable to delete: this item has no item ID code in the API response.")
      );
      return;
    }
    setRowActionError(null);
    setItemPendingDelete(item);
  };

  const confirmDeleteItem = () => {
    if (!itemPendingDelete) return;
    const deleteKey = resolveLivestockDeleteKey(itemPendingDelete);
    if (!deleteKey) return;
    deleteLivestockMutation.mutate(deleteKey);
  };

  const closeDeleteConfirmModal = () => {
    if (deleteLivestockMutation.isPending) return;
    setItemPendingDelete(null);
  };

  const rowActionMutationsPending =
    updateLivestockMutation.isPending ||
    deleteLivestockMutation.isPending ||
    restockLivestockMutation.isPending ||
    deductLivestockMutation.isPending;

  const columns: DataTableColumn<LivestockItem>[] = [
    {
      id: "category",
      header: t("Product Category"),
      cell: (item) => <span className="text-muted-foreground">{getLiveProductName(item.productId)}</span>,
    },
    {
      id: "name",
      header: t("Name"),
      cell: (item) => <span className="font-medium">{item.name}</span>,
    },
    {
      id: "itemId",
      header: t("Item ID"),
      cell: (item) => <span className="font-mono text-sm">{item.itemId}</span>,
    },
    {
      id: "quantity",
      header: t("Quantity"),
      align: "right",
      cell: (item) => (
        <span className="font-mono tabular-nums">{formatLivestockTableQuantity(item)}</span>
      ),
    },
    {
      id: "buyingPrice",
      header: t("Buying price"),
      align: "right",
      cell: (item) => (
        <span className="font-mono tabular-nums">{formatLivestockPriceCell(item.buyingPrice)}</span>
      ),
    },
    {
      id: "sellingPrice",
      header: t("Selling price"),
      align: "right",
      cell: (item) => (
        <span className="font-mono tabular-nums">{formatLivestockPriceCell(item.sellingPrice)}</span>
      ),
    },
    {
      id: "actions",
      header: t("Actions"),
      align: "center",
      cell: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("More options")}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {capabilities.canEditProducts && (
              <DropdownMenuItem
                disabled={rowActionMutationsPending}
                onClick={() => handleOpenEdit(item)}
              >
                {t("Edit")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={rowActionMutationsPending}
              onClick={() =>
                navigate(
                  `/dashboard/product/liveProduct/${encodeURIComponent(item.productId)}/item/${encodeURIComponent(item.itemId)}`,
                  {
                    state: {
                      itemSnapshot: item,
                    } satisfies LivestockDetailLocationState,
                  }
                )
              }
            >
              {t("View")}
            </DropdownMenuItem>
            {capabilities.canRestockLivestockInventory && (
              <DropdownMenuItem
                disabled={rowActionMutationsPending}
                onClick={() => openStockAdjustModal(item, "restock")}
              >
                {t("Restock")}
              </DropdownMenuItem>
            )}
            {capabilities.canDeductLivestockInventory && (
              <DropdownMenuItem
                disabled={rowActionMutationsPending}
                onClick={() => openStockAdjustModal(item, "deduct")}
              >
                {t("Deduct")}
              </DropdownMenuItem>
            )}
            {capabilities.canDeleteProducts && (
              <DropdownMenuItem
                disabled={rowActionMutationsPending}
                className="text-destructive focus:text-destructive"
                onClick={() => requestDeleteItem(item)}
              >
                {t("Delete")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("Live Products")}
        subtitle={t("Products of type Live")}
        breadcrumb={
          <p className="text-sm text-muted-foreground">
            {t("Product")} › {t("Live")}
          </p>
        }
        actions={
          <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto sm:flex-nowrap">
            {capabilities.canCreateProducts && (
              <Button className="shrink-0" onClick={() => {
                setLivestockError(null);
                setLivestockForm(defaultLivestockForm);
                setIsLivestockModalOpen(true);
              }}>
                <Plus className="h-4 w-4" />
                {t("Add Live Stock")}
              </Button>
            )}
            <div className="flex min-w-[170px] flex-1 flex-col gap-2 sm:flex-none">
              <Label htmlFor="category-filter" className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("Category")}
              </Label>
              <Select
                value={selectedCategoryId}
                onValueChange={setSelectedCategoryId}
              >
                <SelectTrigger id="category-filter" className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t("All Categories")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("All Categories")}</SelectItem>
                  {livestockCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative min-w-0 flex-1 basis-full sm:flex-none sm:basis-auto">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("Search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t("Search live products")}
                className="w-full min-w-[150px] pl-9 sm:w-[220px]"
              />
            </div>
          </div>
        }
      />

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as LiveProductMainTab)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="inventory">{t("Inventory")}</TabsTrigger>
          <TabsTrigger value="openingClosing">{t("Opening & closing")}</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-4">
          {rowActionError && <p className="text-sm text-destructive">{rowActionError}</p>}

          <DataTable
            columns={columns}
            rows={paginatedLivestockItems}
            isLoading={categoryLoading || livestockItemsLoading}
            isError={categoryError || livestockItemsError}
            emptyTitle={t("No live stock items yet.")}
            getRowKey={(item, index) => resolveLivestockRowActionKey(item, startIndex + index)}
            footer={
              orderedLivestockItems.length > 0 ? (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={orderedLivestockItems.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  pageSizeOptions={[10, 20, 50]}
                  onPageSizeChange={setPageSize}
                />
              ) : null
            }
          />
        </TabsContent>

        <TabsContent value="openingClosing" className="mt-4">
          <section className="openingClosingStockSection" aria-labelledby="opening-closing-stock-heading">
            <h2 id="opening-closing-stock-heading" className="text-lg font-semibold">
              {t("Live stock opening and closing")}
            </h2>
            <div className="openingClosingStockDateRow">
              <div className="openingClosingStockDateField">
                <Label htmlFor="opening-stock-from" className="openingClosingStockDateLabel">
                  {t("Date from")}
                </Label>
                <Input
                  id="opening-stock-from"
                  type="date"
                  className="openingClosingStockDateInput"
                  value={openingStockFrom}
                  onChange={(e) => setOpeningStockFrom(e.target.value)}
                />
              </div>
              <div className="openingClosingStockDateField">
                <Label htmlFor="opening-stock-to" className="openingClosingStockDateLabel">
                  {t("Date to")}
                </Label>
                <Input
                  id="opening-stock-to"
                  type="date"
                  className="openingClosingStockDateInput"
                  value={openingStockTo}
                  onChange={(e) => setOpeningStockTo(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const todayLocal = toIsoDateLocal(new Date());
                  setOpeningStockFrom(todayLocal);
                  setOpeningStockTo(todayLocal);
                }}
              >
                {t("Today")}
              </Button>
              {openingStockRangeInvalid && (
                <p className="openingClosingStockRangeError" role="alert">
                  {t("End date must be on or after start date.")}
                </p>
              )}
            </div>
            {!openingStockRangeInvalid && clientStockMode === "movementOnly" && (
              <div className="openingClosingStockBanner openingClosingStockBannerInfo" role="status">
                {t(
                  "Past date range: only manual restock and deduct movements are shown. Set \"Date to\" to today to see opening and closing balances. Send-to-processing is not included in this history."
                )}
              </div>
            )}
            {!openingStockRangeInvalid && (
              <div className="openingClosingStockGrid">
                <OpeningStockTable
                  from={openingStockFrom}
                  to={openingStockTo}
                  openingStockData={clientLivestockOpeningStockData}
                  isPending={openingStockPending}
                  isError={openingStockError}
                  errorMessage={openingStockErrorMessage}
                  footnote={
                    clientStockMode === "reconciled"
                      ? t("")
                      : null
                  }
                />
                <ClosingStockTable
                  from={openingStockFrom}
                  to={openingStockTo}
                  openingStockData={clientLivestockOpeningStockData}
                  isPending={openingStockPending}
                  isError={openingStockError}
                  errorMessage={openingStockErrorMessage}
                />
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>

      <ResponsiveOverlay
        isOpen={isLivestockModalOpen && capabilities.canCreateProducts}
        onClose={() => {
          setIsLivestockModalOpen(false);
          setLivestockError(null);
          setLivestockForm(defaultLivestockForm);
        }}
        title={t("Add Live Stock")}
        subtitle={t("Create a live stock item and map it to product category")}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsLivestockModalOpen(false);
                setLivestockError(null);
                setLivestockForm(defaultLivestockForm);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleSubmitLivestock}
              disabled={
                livestockMutation.isPending ||
                !livestockForm.productId ||
                !livestockForm.itemId.trim() ||
                !livestockForm.name.trim() ||
                Number(livestockForm.weight) <= 0 ||
                !livestockForm.buyingPrice.trim() ||
                !livestockForm.sellingPrice.trim() ||
                hasInvalidOptionalPriceField(livestockForm.buyingPrice) ||
                hasInvalidOptionalPriceField(livestockForm.sellingPrice) ||
                !livestockForm.supplierId
              }
            >
              {livestockMutation.isPending ? t("Saving…") : t("Save")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {livestockError && <p className="text-sm text-destructive">{livestockError}</p>}
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-productId">{t("Live Stock Product Category")}</Label>
            <Select
              value={livestockForm.productId}
              onValueChange={(value) => setLivestockForm((prev) => ({ ...prev, productId: value }))}
            >
              <SelectTrigger id="create-productId">
                <SelectValue placeholder={t("Select product category")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t("Select product category")}</SelectItem>
                {livestockCategories.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-itemId">{t("Item ID")}</Label>
            <Input
              id="create-itemId"
              type="text"
              value={livestockForm.itemId}
              onChange={(e) => setLivestockForm((prev) => ({ ...prev, itemId: e.target.value }))}
              placeholder={t("Enter item ID")}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-name">{t("Name of Livestock Item")}</Label>
            <Input
              id="create-name"
              type="text"
              value={livestockForm.name}
              onChange={(e) => setLivestockForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t("Enter name")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-weight">{t("Quantity")}</Label>
            <Input
              id="create-weight"
              type="number"
              min={0}
              step="any"
              value={livestockForm.weight}
              onChange={(e) => setLivestockForm((prev) => ({ ...prev, weight: e.target.value }))}
              placeholder={t("Enter quantity")}
            />
          </div>
          <SupplierPicker
            outletId={userOutletId}
            selectedSupplierId={livestockForm.supplierId}
            disabled={livestockMutation.isPending}
            onSelect={(supplier) => setLivestockForm((previous) => ({
              ...previous,
              supplierId: supplier.id,
              supplierName: supplier.name,
              supplierContact: supplier.contact ?? "",
            }))}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-buyingPrice">{t("Buying price")}</Label>
            <Input
              id="create-buyingPrice"
              type="number"
              min={0}
              step="any"
              value={livestockForm.buyingPrice}
              onChange={(e) => setLivestockForm((prev) => ({ ...prev, buyingPrice: e.target.value }))}
              placeholder={t("Enter buying price")}
              required
              aria-required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-sellingPrice">{t("Selling price")}</Label>
            <Input
              id="create-sellingPrice"
              type="number"
              min={0}
              step="any"
              value={livestockForm.sellingPrice}
              onChange={(e) => setLivestockForm((prev) => ({ ...prev, sellingPrice: e.target.value }))}
              placeholder={t("Enter selling price")}
              required
              aria-required
            />
          </div>
        </div>
      </ResponsiveOverlay>

      <ResponsiveOverlay
        isOpen={isEditLivestockModalOpen && capabilities.canEditProducts}
        onClose={() => {
          setIsEditLivestockModalOpen(false);
          setEditingLivestockId(null);
          setEditLivestockError(null);
          setEditLivestockForm(defaultLivestockForm);
        }}
        title={t("Update Live Stock Item")}
        subtitle={t("Update selected live stock item details")}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsEditLivestockModalOpen(false);
                setEditingLivestockId(null);
                setEditLivestockError(null);
                setEditLivestockForm(defaultLivestockForm);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleSubmitEditLivestock}
              disabled={
                updateLivestockMutation.isPending ||
                !editingLivestockId ||
                !editLivestockForm.productId ||
                !editLivestockForm.name.trim() ||
                Number(editLivestockForm.weight) <= 0 ||
                hasInvalidOptionalPriceField(editLivestockForm.buyingPrice) ||
                hasInvalidOptionalPriceField(editLivestockForm.sellingPrice)
              }
            >
              {updateLivestockMutation.isPending ? t("Saving…") : t("Update")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {editLivestockError && <p className="text-sm text-destructive">{editLivestockError}</p>}
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-productId">{t("Live Stock Product Category")}</Label>
            <Select
              value={editLivestockForm.productId}
              onValueChange={(value) => setEditLivestockForm((prev) => ({ ...prev, productId: value }))}
            >
              <SelectTrigger id="edit-productId">
                <SelectValue placeholder={t("Select product category")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t("Select product category")}</SelectItem>
                {livestockCategories.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-name">{t("Name")}</Label>
            <Input
              id="edit-name"
              type="text"
              value={editLivestockForm.name}
              onChange={(e) => setEditLivestockForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t("Enter name")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-itemId">{t("Item ID")}</Label>
            <Input
              id="edit-itemId"
              type="text"
              readOnly
              aria-readonly="true"
              value={editLivestockForm.itemId}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-weight">{t("Quantity")}</Label>
            <Input
              id="edit-weight"
              type="number"
              min={0}
              step="any"
              value={editLivestockForm.weight}
              onChange={(e) => setEditLivestockForm((prev) => ({ ...prev, weight: e.target.value }))}
              placeholder={t("Enter quantity")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-buyingPrice">{t("Buying price")}</Label>
            <Input
              id="edit-buyingPrice"
              type="number"
              min={0}
              step="any"
              value={editLivestockForm.buyingPrice}
              onChange={(e) => setEditLivestockForm((prev) => ({ ...prev, buyingPrice: e.target.value }))}
              placeholder={t("Optional")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-sellingPrice">{t("Selling price")}</Label>
            <Input
              id="edit-sellingPrice"
              type="number"
              min={0}
              step="any"
              value={editLivestockForm.sellingPrice}
              onChange={(e) => setEditLivestockForm((prev) => ({ ...prev, sellingPrice: e.target.value }))}
              placeholder={t("Optional")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-status">{t("Status")}</Label>
            <Select
              value={editLivestockForm.status}
              onValueChange={(value) =>
                setEditLivestockForm((prev) => ({
                  ...prev,
                  status: value === "Inactive" ? "Inactive" : "Active",
                }))
              }
            >
              <SelectTrigger id="edit-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">{t("Active")}</SelectItem>
                <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </ResponsiveOverlay>

      <ResponsiveOverlay
        isOpen={
          stockAdjustModal != null &&
          (stockAdjustModal.mode === "restock"
            ? capabilities.canRestockLivestockInventory
            : capabilities.canDeductLivestockInventory)
        }
        onClose={closeStockAdjustModal}
        title={
          stockAdjustModal?.mode === "deduct"
            ? t("Deduct livestock stock")
            : t("Restock livestock item")
        }
        subtitle={
          stockAdjustModal?.mode === "deduct"
            ? t("Enter quantity to deduct from stock.")
            : t("Enter quantity to add to stock.")
        }
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeStockAdjustModal}>
              {t("Cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleSubmitStockAdjust}
              disabled={
                restockLivestockMutation.isPending ||
                deductLivestockMutation.isPending ||
                !adjustAmount.trim() ||
                Number(adjustAmount) <= 0 ||
                !Number.isInteger(Number(adjustAmount))
              }
            >
              {restockLivestockMutation.isPending || deductLivestockMutation.isPending
                ? t("Saving…")
                : stockAdjustModal?.mode === "deduct"
                  ? t("Deduct")
                  : t("Restock")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {stockAdjustModal && (
            <p className="text-sm">
              <strong>{stockAdjustModal.item.name}</strong>
              {" · "}
              {t("Item ID")}: {stockAdjustModal.item.itemId}
            </p>
          )}
          {stockAdjustError && <p className="text-sm text-destructive">{stockAdjustError}</p>}
          {stockAdjustModal?.mode === "restock" ? (
            <>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="adjust-quantity">{t("Quantity")}</Label>
                  <Input
                    id="adjust-quantity"
                    type="number"
                    min={1}
                    step={1}
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder={t("Enter quantity")}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="adjust-buyingPrice">{t("Buying price")}</Label>
                  <Input
                    id="adjust-buyingPrice"
                    type="number"
                    min={0}
                    step="any"
                    value={restockBuyingPrice}
                    onChange={(e) => setRestockBuyingPrice(e.target.value)}
                    placeholder={t("Enter buying price")}
                    required
                    aria-required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="adjust-sellingPrice">{t("Selling price")}</Label>
                  <Input
                    id="adjust-sellingPrice"
                    type="number"
                    min={0}
                    step="any"
                    value={restockSellingPrice}
                    onChange={(e) => setRestockSellingPrice(e.target.value)}
                    placeholder={t("Enter selling price")}
                    required
                    aria-required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4">
                <h4 className="font-medium">{t("Supplier & Payment")}</h4>
                <SupplierPicker
                  outletId={stockAdjustModal ? resolveLivestockOutletId(stockAdjustModal.item) || userOutletId : userOutletId}
                  selectedSupplierId={restockSupplierId}
                  disabled={restockLivestockMutation.isPending}
                  onSelect={(supplier) => {
                    setRestockSupplierId(supplier.id);
                    setRestockSupplierName(supplier.name);
                    setRestockSupplierContact(supplier.contact ?? "");
                  }}
                />
                <div className="flex flex-col gap-2">
                  <Label htmlFor="adjust-supplierName">{t("Supplier name")}</Label>
                  <Input
                    id="adjust-supplierName"
                    type="text"
                    value={restockSupplierName}
                    readOnly
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="adjust-supplierContact">{t("Supplier contact")}</Label>
                  <Input
                    id="adjust-supplierContact"
                    type="text"
                    value={restockSupplierContact}
                    readOnly
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="adjust-totalAmount">{t("Total amount")}</Label>
                  <Input
                    id="adjust-totalAmount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={restockTotalAmount}
                    onChange={(e) => setRestockTotalAmount(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="adjust-paidAmount">{t("Paid amount")}</Label>
                  <Input
                    id="adjust-paidAmount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={restockPaidAmount}
                    onChange={(e) => setRestockPaidAmount(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t("Due amount")}</Label>
                  <Input
                    type="number"
                    value={computeDueAmount(Number(restockTotalAmount) || 0, Number(restockPaidAmount) || 0)}
                    readOnly
                    tabIndex={-1}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t("Payment status")}</Label>
                  <div>
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                      derivePaymentStatus(Number(restockTotalAmount) || 0, Number(restockPaidAmount) || 0) === "FULL"
                        ? "border-transparent bg-primary text-primary-foreground"
                        : derivePaymentStatus(Number(restockTotalAmount) || 0, Number(restockPaidAmount) || 0) === "PARTIAL"
                        ? "border-transparent bg-amber-50 text-amber-700"
                        : "border-transparent bg-sky-50 text-sky-700"
                    }`}>
                      {derivePaymentStatus(Number(restockTotalAmount) || 0, Number(restockPaidAmount) || 0) === "FULL"
                        ? t("Full")
                        : derivePaymentStatus(Number(restockTotalAmount) || 0, Number(restockPaidAmount) || 0) === "PARTIAL"
                        ? t("Partial")
                        : t("Advance")}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="adjust-remarks">{t("Remarks")}</Label>
                  <textarea
                    id="adjust-remarks"
                    rows={1}
                    value={restockRemarks}
                    onChange={(e) => setRestockRemarks(e.target.value)}
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="adjust-quantity">{t("Quantity")}</Label>
              <Input
                id="adjust-quantity"
                type="number"
                min={1}
                step={1}
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder={t("Enter quantity")}
              />
            </div>
          )}
        </div>
      </ResponsiveOverlay>

      <ConfirmDialog
        isOpen={itemPendingDelete != null && capabilities.canDeleteProducts}
        title={t("Delete live stock item")}
        message={
          itemPendingDelete
            ? `${t("Are you sure you want to delete this live stock item?")} "${itemPendingDelete.name}" (${t("Item ID")}: ${itemPendingDelete.itemId}). ${t("This action cannot be undone.")}`
            : ""
        }
        confirmLabel={t("Delete")}
        cancelLabel={t("Cancel")}
        variant="danger"
        loading={deleteLivestockMutation.isPending}
        onClose={closeDeleteConfirmModal}
        onConfirm={confirmDeleteItem}
      />
    </div>
  );
}
