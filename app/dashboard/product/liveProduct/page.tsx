"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/app/providers/I18nProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import ConfirmModal from "@/app/components/Modal/ConfirmModal";
import Modal from "@/app/components/Modal/Modal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import {
  clearLivestockItemsCache,
  createLivestockItem,
  deductLivestockItem,
  deleteLivestockItem,
  getLivestockCategories,
  getLivestockItemsByProduct,
  getOpeningStock,
  resolveLivestockDeleteKey,
  resolveLivestockItemId,
  restockLivestockItem,
  updateLivestockItem,
  type LivestockItem,
} from "@/handlers/product";
import type { LivestockDetailLocationState } from "@/app/dashboard/product/lib/inventoryDetailTypes";
import OpeningStockTable from "./components/OpeningStockTable";
import ClosingStockTable from "./components/ClosingStockTable";
import { computeRowMenuPosition, ROW_MENU_HEIGHT_ESTIMATE_PX } from "@/lib/rowMenuPosition";
import { MdMoreHoriz } from "react-icons/md";
import "./liveProduct.scss";

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
};

const defaultLivestockForm: LivestockFormState = {
  productId: "",
  name: "",
  itemId: "",
  weight: "",
  buyingPrice: "",
  sellingPrice: "",
  status: "Active",
};

type StockAdjustModalState = { item: LivestockItem; mode: "restock" | "deduct" } | null;

type OpenRowMenuState = {
  rowKey: string;
  item: LivestockItem;
  placement: "above" | "below";
  top: number;
  bottom: number;
  right: number;
};

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

/** Empty → null; valid positive number → value; invalid partial input → null after validation elsewhere. */
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
  };
}

function toNormalizedItem(item: LivestockItem): LivestockItem {
  const id = resolveLivestockItemId(item);
  return {
    ...item,
    ...(id ? { id } : {}),
  };
}

/** Table "Quantity" column: only API `quantity` (head count / units), never body weight (kg). */
function formatLivestockTableQuantity(item: LivestockItem): string {
  if (typeof item.quantity === "number" && Number.isFinite(item.quantity)) {
    return String(item.quantity);
  }
  return "\u2014";
}

function formatLivestockPriceCell(value: number | null | undefined): string {
  if (value != null && Number.isFinite(value)) {
    return value.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return "\u2014";
}

function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function LiveProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
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
  const [openRowMenu, setOpenRowMenu] = useState<OpenRowMenuState | null>(null);
  const [itemPendingDelete, setItemPendingDelete] = useState<LivestockItem | null>(null);
  const rowMenuButtonRef = useRef<HTMLDivElement>(null);
  const rowMenuPortalRef = useRef<HTMLDivElement>(null);
  const [mainTab, setMainTab] = useState<LiveProductMainTab>("inventory");

  const [openingStockFrom, setOpeningStockFrom] = useState(() => toIsoDateLocal(new Date()));
  const [openingStockTo, setOpeningStockTo] = useState(() => toIsoDateLocal(new Date()));
  const openingStockRangeInvalid = openingStockFrom > openingStockTo;

  const {
    data: openingStockData,
    isPending: openingStockPending,
    isError: openingStockError,
    error: openingStockErrorDetail,
  } = useQuery({
    queryKey: ["livestockOpeningStock", openingStockFrom, openingStockTo],
    enabled: !openingStockRangeInvalid,
    staleTime: 60_000,
    queryFn: async () => {
      const result = await getOpeningStock(openingStockFrom, openingStockTo);
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const openingStockErrorMessage = openingStockError
    ? openingStockErrorDetail instanceof Error && openingStockErrorDetail.message.trim()
      ? openingStockErrorDetail.message
      : t("Opening stock data is not available yet.")
    : null;

  const {
    data: livestockCategories = [],
    isLoading: categoryLoading,
    isError: categoryError,
    error: categoryErrorDetail,
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
    error: livestockItemsErrorDetail,
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
          // Some product/category ids may be stale on live; skip those rows
          // instead of crashing the whole page.
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

  /** Matches CSS that shows the fixed table (desktop) vs card grid (mobile). Both are mounted; ref must attach only to the visible one or getBoundingClientRect is 0 for display:none. */
  const [isWideViewport, setIsWideViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 769px)").matches : true
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 769px)");
    const onChange = () => setIsWideViewport(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategoryId, searchQuery, setCurrentPage]);

  const closeRowMenu = useCallback(() => {
    setOpenRowMenu(null);
  }, []);

  useEffect(() => {
    if (mainTab !== "inventory") closeRowMenu();
  }, [mainTab, closeRowMenu]);

  useLayoutEffect(() => {
    if (!openRowMenu) return;
    const syncMenuPosition = () => {
      const wrap = rowMenuButtonRef.current;
      const btn = wrap?.querySelector<HTMLButtonElement>(".rowMenuTrigger");
      if (!wrap || !btn) return;
      const rect = btn.getBoundingClientRect();
      const menuEl = rowMenuPortalRef.current;
      const measured = menuEl?.offsetHeight ?? 0;
      const h = Math.max(measured, ROW_MENU_HEIGHT_ESTIMATE_PX);
      const menuWidth =
        menuEl && menuEl.offsetWidth > 0 ? menuEl.offsetWidth : undefined;
      const pos = computeRowMenuPosition(rect, h, { menuWidth });
      setOpenRowMenu((prev) =>
        prev
          ? {
              ...prev,
              placement: pos.placement,
              top: pos.top,
              bottom: pos.bottom,
              right: pos.right,
            }
          : null
      );
    };
    syncMenuPosition();
    const raf = requestAnimationFrame(() => syncMenuPosition());
    window.addEventListener("scroll", syncMenuPosition, true);
    window.addEventListener("resize", syncMenuPosition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", syncMenuPosition, true);
      window.removeEventListener("resize", syncMenuPosition);
    };
  }, [openRowMenu?.rowKey, isWideViewport]);

  useEffect(() => {
    if (!openRowMenu) return;
    const handlePointerDownOutside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rowMenuButtonRef.current?.contains(target)) return;
      if (rowMenuPortalRef.current?.contains(target)) return;
      closeRowMenu();
    };
    const scheduleId = window.setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDownOutside);
    }, 0);
    return () => {
      window.clearTimeout(scheduleId);
      document.removeEventListener("pointerdown", handlePointerDownOutside);
    };
  }, [openRowMenu, closeRowMenu]);

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
    const trimmedItemId = form.itemId.trim();
    const weight = Number(form.weight);
    const buyingPrice = parsePriceFieldForSubmit(form.buyingPrice);
    const sellingPrice = parsePriceFieldForSubmit(form.sellingPrice);

    if (!form.productId) return setError(t("Please select live stock product category.")), null;
    if (!trimmedName) return setError(t("Name is required.")), null;
    if (!trimmedItemId) return setError(t("Item ID is required.")), null;
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
    };
  };

  const handleSubmitLivestock = () => {
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
    closeRowMenu();
    setIsEditLivestockModalOpen(true);
  };

  const handleSubmitEditLivestock = () => {
    if (!editingLivestockId) return;
    const sourceItem = livestockItems.find((row) => resolveLivestockItemId(row) === editingLivestockId);
    const outletId = sourceItem ? resolveLivestockOutletId(sourceItem) : "";
    const trimmedName = editLivestockForm.name.trim();
    const trimmedItemId = editLivestockForm.itemId.trim();
    const weight = Number(editLivestockForm.weight);
    const buyingPrice = parsePriceFieldForSubmit(editLivestockForm.buyingPrice);
    const sellingPrice = parsePriceFieldForSubmit(editLivestockForm.sellingPrice);

    if (!editLivestockForm.productId) return setEditLivestockError(t("Please select live stock product category."));
    if (!trimmedName) return setEditLivestockError(t("Name is required."));
    if (!trimmedItemId) return setEditLivestockError(t("Item ID is required."));
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
      itemId: trimmedItemId,
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
    closeRowMenu();
  };

  const closeStockAdjustModal = () => {
    setStockAdjustModal(null);
    setAdjustAmount("");
    setStockAdjustError(null);
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
      restockLivestockMutation.mutate({ livestockItemId: id, quantity: amount });
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
    closeRowMenu();
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

  const renderLivestockRowActions = (
    item: LivestockItem,
    rowKey: string,
    surface: "table" | "mobile"
  ) => {
    const refActive =
      openRowMenu?.rowKey === rowKey &&
      ((surface === "table" && isWideViewport) || (surface === "mobile" && !isWideViewport));
    return (
    <div className="productsRowActions">
      <div
        className={`rowActionMenu rowActionFloating${openRowMenu?.rowKey === rowKey ? " rowActionMenuOpen" : ""}`}
        ref={refActive ? rowMenuButtonRef : undefined}
      >
        <button
          type="button"
          className="rowMenuTrigger"
          onClick={(e) => {
            e.stopPropagation();
            const trigger = e.currentTarget;
            const rect = trigger.getBoundingClientRect();
            setOpenRowMenu((prev) => {
              if (prev?.rowKey === rowKey) return null;
              const pos = computeRowMenuPosition(rect, ROW_MENU_HEIGHT_ESTIMATE_PX);
              return {
                rowKey,
                item,
                placement: pos.placement,
                top: pos.top,
                bottom: pos.bottom,
                right: pos.right,
              };
            });
          }}
          aria-label={t("More options")}
          aria-expanded={openRowMenu?.rowKey === rowKey}
          aria-haspopup="menu"
        >
          <MdMoreHoriz aria-hidden size={22} />
        </button>
      </div>
    </div>
    );
  };

  return (
    <section className="liveProductPage">
      <div className="breadcrumb">
        <span>{t("Product")}</span> {" > "} {t("Live")}
      </div>

      <div className="liveProductHeader">
        <div className="liveProductHeaderText">
          <h1 className="pageTitle">{t("Live Products")}</h1>
          <p className="pageSubtitle">{t("Products of type Live")}</p>
        </div>
        <div className="liveProductHeaderActions">
          <button
            type="button"
            className="addLivestockBtn"
            onClick={() => {
              setLivestockError(null);
              setLivestockForm(defaultLivestockForm);
              setIsLivestockModalOpen(true);
            }}
          >
            {t("Add Live Stock")}
          </button>
          <select
            className="liveProductCategoryFilter"
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            aria-label={t("Filter by livestock category")}
          >
            <option value="all">{t("All Categories")}</option>
            {livestockCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <div className="liveProductSearch">
            <span className="searchIcon">🔍</span>
            <input
              className="searchInput"
              placeholder={t("Search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t("Search live products")}
            />
          </div>
        </div>
      </div>

      <div
        className="liveProductTabs"
        role="tablist"
        aria-label={t("Live Products views")}
      >
        <button
          type="button"
          id="live-product-tab-inventory"
          role="tab"
          aria-selected={mainTab === "inventory"}
          aria-controls="live-product-panel-inventory"
          tabIndex={mainTab === "inventory" ? 0 : -1}
          className={`liveProductTab${mainTab === "inventory" ? " liveProductTabActive" : ""}`}
          onClick={() => setMainTab("inventory")}
        >
          {t("Inventory")}
        </button>
        <button
          type="button"
          id="live-product-tab-opening"
          role="tab"
          aria-selected={mainTab === "openingClosing"}
          aria-controls="live-product-panel-opening"
          tabIndex={mainTab === "openingClosing" ? 0 : -1}
          className={`liveProductTab${mainTab === "openingClosing" ? " liveProductTabActive" : ""}`}
          onClick={() => setMainTab("openingClosing")}
        >
          {t("Opening & closing")}
        </button>
      </div>

      {mainTab === "inventory" && (
        <div
          id="live-product-panel-inventory"
          role="tabpanel"
          aria-labelledby="live-product-tab-inventory"
          className="liveProductTabPanel"
        >
      {rowActionError && <p className="productsMessage productsError">{rowActionError}</p>}

      <div className="productsTable">
        <table
          className="livestockInventoryTable livestockInventoryTableDesktop"
          aria-label={t("Inventory")}
        >
          <colgroup>
            <col className="livestockInventoryCol livestockInventoryCol--category" />
            <col className="livestockInventoryCol livestockInventoryCol--name" />
            <col className="livestockInventoryCol livestockInventoryCol--itemId" />
            <col className="livestockInventoryCol livestockInventoryCol--quantity" />
            <col className="livestockInventoryCol livestockInventoryCol--buy" />
            <col className="livestockInventoryCol livestockInventoryCol--sell" />
            <col className="livestockInventoryCol livestockInventoryCol--actions" />
          </colgroup>
          <thead>
            <tr className="livestockInventoryTableHeadRow">
              <th scope="col">{t("Product Category")}</th>
              <th scope="col">{t("Name")}</th>
              <th scope="col">{t("Item ID")}</th>
              <th scope="col">{t("Quantity")}</th>
              <th scope="col">{t("Buying price")}</th>
              <th scope="col">{t("Selling price")}</th>
              <th scope="col">{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {(categoryLoading || livestockItemsLoading) && (
              <tr className="livestockInventoryTableMessageRow">
                <td colSpan={7}>
                  <span className="productsMessage">{t("Loading…")}</span>
                </td>
              </tr>
            )}
            {categoryError && (
              <tr className="livestockInventoryTableMessageRow">
                <td colSpan={7}>
                  <span className="productsMessage productsError">
                    {categoryErrorDetail instanceof Error
                      ? categoryErrorDetail.message
                      : t("Failed to load livestock categories")}
                  </span>
                </td>
              </tr>
            )}
            {livestockItemsError && (
              <tr className="livestockInventoryTableMessageRow">
                <td colSpan={7}>
                  <span className="productsMessage productsError">
                    {livestockItemsErrorDetail instanceof Error
                      ? livestockItemsErrorDetail.message
                      : t("Failed to load live stock items")}
                  </span>
                </td>
              </tr>
            )}
            {!categoryLoading &&
              !categoryError &&
              !livestockItemsLoading &&
              !livestockItemsError &&
              filteredLivestockItems.length === 0 && (
                <tr className="livestockInventoryTableMessageRow">
                  <td colSpan={7}>
                    <span className="productsMessage">{t("No live stock items yet.")}</span>
                  </td>
                </tr>
              )}
            {!categoryLoading &&
              !categoryError &&
              !livestockItemsLoading &&
              !livestockItemsError &&
              paginatedLivestockItems.map((item, index) => {
                const rowKey = resolveLivestockRowActionKey(item, startIndex + index);
                return (
                  <tr key={rowKey} className="livestockInventoryTableDataRow">
                    <td>{getLiveProductName(item.productId)}</td>
                    <td>{item.name}</td>
                    <td>{item.itemId}</td>
                    <td>{formatLivestockTableQuantity(item)}</td>
                    <td>{formatLivestockPriceCell(item.buyingPrice)}</td>
                    <td>{formatLivestockPriceCell(item.sellingPrice)}</td>
                    <td className="livestockInventoryTableCellActions">
                      {renderLivestockRowActions(item, rowKey, "table")}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        <div className="livestockInventoryMobile">
          <div className="productsRow productsRowHeader livestockInventoryRowHeader livestockRowHeader">
            <span>{t("Product Category")}</span>
            <span>{t("Name")}</span>
            <span>{t("Item ID")}</span>
            <span>{t("Quantity")}</span>
            <span>{t("Buying price")}</span>
            <span>{t("Selling price")}</span>
            <span>{t("Actions")}</span>
          </div>
          {(categoryLoading || livestockItemsLoading) && (
            <div className="productsRow livestockRowWithActions livestockRowMessage">
              <span className="productsMessage">{t("Loading…")}</span>
            </div>
          )}
          {categoryError && (
            <div className="productsRow livestockRowWithActions livestockRowMessage">
              <span className="productsMessage productsError">
                {categoryErrorDetail instanceof Error
                  ? categoryErrorDetail.message
                  : t("Failed to load livestock categories")}
              </span>
            </div>
          )}
          {livestockItemsError && (
            <div className="productsRow livestockRowWithActions livestockRowMessage">
              <span className="productsMessage productsError">
                {livestockItemsErrorDetail instanceof Error
                  ? livestockItemsErrorDetail.message
                  : t("Failed to load live stock items")}
              </span>
            </div>
          )}
          {!categoryLoading &&
            !categoryError &&
            !livestockItemsLoading &&
            !livestockItemsError &&
            filteredLivestockItems.length === 0 && (
              <div className="productsRow livestockRowWithActions livestockRowMessage">
                <span className="productsMessage">{t("No live stock items yet.")}</span>
              </div>
            )}
          {!categoryLoading &&
            !categoryError &&
            !livestockItemsLoading &&
            !livestockItemsError &&
            paginatedLivestockItems.map((item, index) => {
              const rowKey = resolveLivestockRowActionKey(item, startIndex + index);
              return (
                <div
                  key={rowKey}
                  className="productsRow livestockRowWithActions livestockRowData"
                >
                  <span data-label={t("Product Category")}>
                    {getLiveProductName(item.productId)}
                  </span>
                  <span data-label={t("Name")}>{item.name}</span>
                  <span data-label={t("Item ID")}>{item.itemId}</span>
                  <span data-label={t("Quantity")}>
                    {formatLivestockTableQuantity(item)}
                  </span>
                  <span data-label={t("Buying price")}>{formatLivestockPriceCell(item.buyingPrice)}</span>
                  <span data-label={t("Selling price")}>{formatLivestockPriceCell(item.sellingPrice)}</span>
                  {renderLivestockRowActions(item, rowKey, "mobile")}
                </div>
              );
            })}
        </div>
      </div>

      {openRowMenu &&
        createPortal(
          <div
            ref={rowMenuPortalRef}
            className="rowMenuDropdown rowMenuDropdownPortal"
            style={
              openRowMenu.placement === "below"
                ? {
                    position: "fixed",
                    top: openRowMenu.top,
                    right: openRowMenu.right,
                    bottom: "auto",
                    zIndex: 20000,
                  }
                : {
                    position: "fixed",
                    bottom: openRowMenu.bottom,
                    right: openRowMenu.right,
                    top: "auto",
                    zIndex: 20000,
                  }
            }
            role="menu"
          >
            <button
              type="button"
              className="rowMenuItem"
              role="menuitem"
              disabled={rowActionMutationsPending}
              onMouseDown={(e) => {
                e.preventDefault();
                if (rowActionMutationsPending) return;
                closeRowMenu();
                handleOpenEdit(openRowMenu.item);
              }}
            >
              {t("Edit")}
            </button>
            <button
              type="button"
              className="rowMenuItem"
              role="menuitem"
              disabled={rowActionMutationsPending}
              onMouseDown={(e) => {
                e.preventDefault();
                if (rowActionMutationsPending) return;
                closeRowMenu();
                navigate(
                  `/dashboard/product/liveProduct/${encodeURIComponent(openRowMenu.item.productId)}/item/${encodeURIComponent(openRowMenu.item.itemId)}`,
                  {
                    state: {
                      itemSnapshot: openRowMenu.item,
                    } satisfies LivestockDetailLocationState,
                  }
                );
              }}
            >
              {t("View")}
            </button>
            <button
              type="button"
              className="rowMenuItem"
              role="menuitem"
              disabled={rowActionMutationsPending}
              onMouseDown={(e) => {
                e.preventDefault();
                if (rowActionMutationsPending) return;
                closeRowMenu();
                openStockAdjustModal(openRowMenu.item, "restock");
              }}
            >
              {t("Restock")}
            </button>
            <button
              type="button"
              className="rowMenuItem"
              role="menuitem"
              disabled={rowActionMutationsPending}
              onMouseDown={(e) => {
                e.preventDefault();
                if (rowActionMutationsPending) return;
                closeRowMenu();
                openStockAdjustModal(openRowMenu.item, "deduct");
              }}
            >
              {t("Deduct")}
            </button>
            <button
              type="button"
              className="rowMenuItem rowMenuItemDelete"
              role="menuitem"
              disabled={rowActionMutationsPending}
              onMouseDown={(e) => {
                e.preventDefault();
                if (rowActionMutationsPending) return;
                closeRowMenu();
                requestDeleteItem(openRowMenu.item);
              }}
            >
              {t("Delete")}
            </button>
          </div>,
          document.body
        )}

      {!categoryLoading &&
        !categoryError &&
        !livestockItemsLoading &&
        !livestockItemsError &&
        orderedLivestockItems.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={orderedLivestockItems.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            pageSizeOptions={[10, 20, 50]}
            onPageSizeChange={setPageSize}
          />
        )}
        </div>
      )}

      {mainTab === "openingClosing" && (
        <div
          id="live-product-panel-opening"
          role="tabpanel"
          aria-labelledby="live-product-tab-opening"
          className="liveProductTabPanel"
        >
      <section className="openingClosingStockSection" aria-labelledby="opening-closing-stock-heading">
        <h2 id="opening-closing-stock-heading" className="pageTitle" style={{ fontSize: "18px", margin: 0 }}>
          {t("Live stock opening and closing")}
        </h2>
        <div className="openingClosingStockDateRow">
          <div className="openingClosingStockDateField">
            <label className="openingClosingStockDateLabel" htmlFor="opening-stock-from">
              {t("Date from")}
            </label>
            <input
              id="opening-stock-from"
              type="date"
              className="openingClosingStockDateInput"
              value={openingStockFrom}
              onChange={(e) => setOpeningStockFrom(e.target.value)}
            />
          </div>
          <div className="openingClosingStockDateField">
            <label className="openingClosingStockDateLabel" htmlFor="opening-stock-to">
              {t("Date to")}
            </label>
            <input
              id="opening-stock-to"
              type="date"
              className="openingClosingStockDateInput"
              value={openingStockTo}
              onChange={(e) => setOpeningStockTo(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="openingClosingStockTodayBtn"
            onClick={() => {
              const todayLocal = toIsoDateLocal(new Date());
              setOpeningStockFrom(todayLocal);
              setOpeningStockTo(todayLocal);
            }}
          >
            {t("Today")}
          </button>
          {openingStockRangeInvalid && (
            <p className="openingClosingStockRangeError" role="alert">
              {t("End date must be on or after start date.")}
            </p>
          )}
        </div>
        {!openingStockRangeInvalid && (
          <div className="openingClosingStockGrid">
            <OpeningStockTable
              from={openingStockFrom}
              to={openingStockTo}
              openingStockData={openingStockData}
              isPending={openingStockPending}
              isError={openingStockError}
              errorMessage={openingStockErrorMessage}
            />
            <ClosingStockTable
              from={openingStockFrom}
              to={openingStockTo}
              openingStockData={openingStockData}
              isPending={openingStockPending}
              isError={openingStockError}
              errorMessage={openingStockErrorMessage}
            />
          </div>
        )}
      </section>
        </div>
      )}

      <Modal
        isOpen={isLivestockModalOpen}
        title={t("Add Live Stock")}
        subtitle={t("Create a live stock item and map it to product category")}
        onClose={() => {
          setIsLivestockModalOpen(false);
          setLivestockError(null);
          setLivestockForm(defaultLivestockForm);
        }}
        footer={
          <div className="productActionModalFooter">
            <button
              type="button"
              className="productActionModalCancel"
              onClick={() => {
                setIsLivestockModalOpen(false);
                setLivestockError(null);
                setLivestockForm(defaultLivestockForm);
              }}
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              className="productActionModalSubmit"
              onClick={handleSubmitLivestock}
              disabled={
                livestockMutation.isPending ||
                !livestockForm.productId ||
                !livestockForm.name.trim() ||
                !livestockForm.itemId.trim() ||
                Number(livestockForm.weight) <= 0 ||
                !livestockForm.buyingPrice.trim() ||
                !livestockForm.sellingPrice.trim() ||
                hasInvalidOptionalPriceField(livestockForm.buyingPrice) ||
                hasInvalidOptionalPriceField(livestockForm.sellingPrice)
              }
            >
              {livestockMutation.isPending ? t("Saving…") : t("Save")}
            </button>
          </div>
        }
      >
        <div className="productActionModalBody">
          {livestockError && <p className="productActionModalError">{livestockError}</p>}
          <label className="productActionModalLabel">
            {t("Live Stock Product Category")}
            <select
              value={livestockForm.productId}
              onChange={(e) => setLivestockForm((prev) => ({ ...prev, productId: e.target.value }))}
              className="productActionModalSelect"
            >
              <option value="">{t("Select product category")}</option>
              {livestockCategories.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label className="productActionModalLabel">
            {t("Name of Livestock Item")}
            <input
              type="text"
              value={livestockForm.name}
              onChange={(e) => setLivestockForm((prev) => ({ ...prev, name: e.target.value }))}
              className="productActionModalInput"
              placeholder={t("Enter name")}
            />
          </label>
          <label className="productActionModalLabel">
            {t("Item ID")}
            <input
              type="text"
              value={livestockForm.itemId}
              onChange={(e) => setLivestockForm((prev) => ({ ...prev, itemId: e.target.value }))}
              className="productActionModalInput"
              placeholder={t("Enter item ID")}
            />
          </label>
          <label className="productActionModalLabel">
            {t("Quantity")}
            <input
              type="number"
              min={0}
              step="any"
              value={livestockForm.weight}
              onChange={(e) => setLivestockForm((prev) => ({ ...prev, weight: e.target.value }))}
              className="productActionModalInput"
              placeholder={t("Enter quantity")}
            />
          </label>
          <label className="productActionModalLabel">
            {t("Buying price")}
            <input
              type="number"
              min={0}
              step="any"
              value={livestockForm.buyingPrice}
              onChange={(e) => setLivestockForm((prev) => ({ ...prev, buyingPrice: e.target.value }))}
              className="productActionModalInput"
              placeholder={t("Enter buying price")}
              required
              aria-required
            />
          </label>
          <label className="productActionModalLabel">
            {t("Selling price")}
            <input
              type="number"
              min={0}
              step="any"
              value={livestockForm.sellingPrice}
              onChange={(e) => setLivestockForm((prev) => ({ ...prev, sellingPrice: e.target.value }))}
              className="productActionModalInput"
              placeholder={t("Enter selling price")}
              required
              aria-required
            />
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={isEditLivestockModalOpen}
        title={t("Update Live Stock Item")}
        subtitle={t("Update selected live stock item details")}
        onClose={() => {
          setIsEditLivestockModalOpen(false);
          setEditingLivestockId(null);
          setEditLivestockError(null);
          setEditLivestockForm(defaultLivestockForm);
        }}
        footer={
          <div className="productActionModalFooter">
            <button
              type="button"
              className="productActionModalCancel"
              onClick={() => {
                setIsEditLivestockModalOpen(false);
                setEditingLivestockId(null);
                setEditLivestockError(null);
                setEditLivestockForm(defaultLivestockForm);
              }}
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              className="productActionModalSubmit"
              onClick={handleSubmitEditLivestock}
              disabled={
                updateLivestockMutation.isPending ||
                !editingLivestockId ||
                !editLivestockForm.productId ||
                !editLivestockForm.name.trim() ||
                !editLivestockForm.itemId.trim() ||
                Number(editLivestockForm.weight) <= 0 ||
                hasInvalidOptionalPriceField(editLivestockForm.buyingPrice) ||
                hasInvalidOptionalPriceField(editLivestockForm.sellingPrice)
              }
            >
              {updateLivestockMutation.isPending ? t("Saving…") : t("Update")}
            </button>
          </div>
        }
      >
        <div className="productActionModalBody">
          {editLivestockError && <p className="productActionModalError">{editLivestockError}</p>}
          <label className="productActionModalLabel">
            {t("Live Stock Product Category")}
            <select
              value={editLivestockForm.productId}
              onChange={(e) => setEditLivestockForm((prev) => ({ ...prev, productId: e.target.value }))}
              className="productActionModalSelect"
            >
              <option value="">{t("Select product category")}</option>
              {livestockCategories.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label className="productActionModalLabel">
            {t("Name")}
            <input
              type="text"
              value={editLivestockForm.name}
              onChange={(e) => setEditLivestockForm((prev) => ({ ...prev, name: e.target.value }))}
              className="productActionModalInput"
              placeholder={t("Enter name")}
            />
          </label>
          <label className="productActionModalLabel">
            {t("Item ID")}
            <input
              type="text"
              value={editLivestockForm.itemId}
              onChange={(e) => setEditLivestockForm((prev) => ({ ...prev, itemId: e.target.value }))}
              className="productActionModalInput"
              placeholder={t("Enter item ID")}
            />
          </label>
          <label className="productActionModalLabel">
            {t("Quantity")}
            <input
              type="number"
              min={0}
              step="any"
              value={editLivestockForm.weight}
              onChange={(e) => setEditLivestockForm((prev) => ({ ...prev, weight: e.target.value }))}
              className="productActionModalInput"
              placeholder={t("Enter quantity")}
            />
          </label>
          <label className="productActionModalLabel">
            {t("Buying price")}
            <input
              type="number"
              min={0}
              step="any"
              value={editLivestockForm.buyingPrice}
              onChange={(e) => setEditLivestockForm((prev) => ({ ...prev, buyingPrice: e.target.value }))}
              className="productActionModalInput"
              placeholder={t("Optional")}
            />
          </label>
          <label className="productActionModalLabel">
            {t("Selling price")}
            <input
              type="number"
              min={0}
              step="any"
              value={editLivestockForm.sellingPrice}
              onChange={(e) => setEditLivestockForm((prev) => ({ ...prev, sellingPrice: e.target.value }))}
              className="productActionModalInput"
              placeholder={t("Optional")}
            />
          </label>
          <label className="productActionModalLabel">
            {t("Status")}
            <select
              value={editLivestockForm.status}
              onChange={(e) =>
                setEditLivestockForm((prev) => ({
                  ...prev,
                  status: e.target.value === "Inactive" ? "Inactive" : "Active",
                }))
              }
              className="productActionModalSelect"
            >
              <option value="Active">{t("Active")}</option>
              <option value="Inactive">{t("Inactive")}</option>
            </select>
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={stockAdjustModal != null}
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
        onClose={closeStockAdjustModal}
        footer={
          <div className="productActionModalFooter">
            <button type="button" className="productActionModalCancel" onClick={closeStockAdjustModal}>
              {t("Cancel")}
            </button>
            <button
              type="button"
              className="productActionModalSubmit"
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
            </button>
          </div>
        }
      >
        <div className="productActionModalBody">
          {stockAdjustModal && (
            <p className="stockAdjustModalItemSummary">
              <strong>{stockAdjustModal.item.name}</strong>
              {" · "}
              {t("Item ID")}: {stockAdjustModal.item.itemId}
            </p>
          )}
          {stockAdjustError && <p className="productActionModalError">{stockAdjustError}</p>}
          <label className="productActionModalLabel">
            {t("Quantity")}
            <input
              type="number"
              min={1}
              step={1}
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              className="productActionModalInput"
              placeholder={t("Enter quantity")}
            />
          </label>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={itemPendingDelete != null}
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
    </section>
  );
}
