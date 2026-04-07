"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/app/providers/I18nProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import Modal from "@/app/components/Modal/Modal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import {
  clearLivestockItemsCache,
  createLivestockItem,
  deductLivestockItem,
  deleteLivestockItem,
  getLivestockCategories,
  getLivestockItemsByProduct,
  restockLivestockItem,
  updateLivestockItem,
  type LivestockItem,
} from "@/handlers/product";
import { MdMoreHoriz } from "react-icons/md";
import "./liveProduct.scss";

const LIVESTOCK_CATEGORY_QUERY_KEY = ["livestockCategories"];
const LIVESTOCK_ITEMS_QUERY_KEY = ["livestockItemsByProduct"];

type LivestockFormState = {
  productId: string;
  name: string;
  itemId: string;
  weight: string;
  price: string;
  status: "Active" | "Inactive";
  isBulk: boolean;
};

const defaultLivestockForm: LivestockFormState = {
  productId: "",
  name: "",
  itemId: "",
  weight: "",
  price: "",
  status: "Active",
  isBulk: false,
};

type StockAdjustModalState = { item: LivestockItem; mode: "restock" | "deduct" } | null;

function resolveLivestockItemId(item: LivestockItem): string | null {
  const withUnderscore = item as unknown as { _id?: unknown };
  const withLivestockItemId = item as unknown as { livestockItemId?: unknown };
  const fromId = typeof item.id === "string" ? item.id : null;
  const fromUnderscore = typeof withUnderscore._id === "string" ? withUnderscore._id : null;
  const fromLivestockItemId =
    typeof withLivestockItemId.livestockItemId === "string" ? withLivestockItemId.livestockItemId : null;
  return fromId ?? fromUnderscore ?? fromLivestockItemId ?? null;
}

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

function toFormState(item: LivestockItem): LivestockFormState {
  return {
    productId: item.productId,
    name: item.name ?? "",
    itemId: item.itemId ?? "",
    weight: item.weight != null ? String(item.weight) : "",
    price: item.price != null ? String(item.price) : "",
    status: item.status ? "Active" : "Inactive",
    isBulk: item.isBulk === true,
  };
}

function toNormalizedItem(item: LivestockItem): LivestockItem {
  const id = resolveLivestockItemId(item);
  return {
    ...item,
    ...(id ? { id } : {}),
  };
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
  const [adjustIsBulk, setAdjustIsBulk] = useState(false);
  const [stockAdjustError, setStockAdjustError] = useState<string | null>(null);
  const [openRowMenuKey, setOpenRowMenuKey] = useState<string | null>(null);
  const rowMenuButtonRef = useRef<HTMLDivElement>(null);

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
      return (
        item.name.toLowerCase().includes(q) ||
        item.itemId.toLowerCase().includes(q) ||
        String(item.weight).includes(q) ||
        String(item.price).includes(q) ||
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

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategoryId, searchQuery, setCurrentPage]);

  useEffect(() => {
    if (!openRowMenuKey) return;
    const handlePointerDownOutside = (e: PointerEvent) => {
      if (
        rowMenuButtonRef.current &&
        !rowMenuButtonRef.current.contains(e.target as Node)
      ) {
        setOpenRowMenuKey(null);
      }
    };
    const scheduleId = window.setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDownOutside);
    }, 0);
    return () => {
      window.clearTimeout(scheduleId);
      document.removeEventListener("pointerdown", handlePointerDownOutside);
    };
  }, [openRowMenuKey]);

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
    },
    onError: () => {
      setStockAdjustError(t("Something went wrong. Please try again."));
    },
  });

  const deleteLivestockMutation = useMutation({
    mutationFn: (productId: string) => deleteLivestockItem({ productId }),
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
    const price = Number(form.price);

    if (!form.productId) return setError(t("Please select live stock product category.")), null;
    if (!trimmedName) return setError(t("Name is required.")), null;
    if (!trimmedItemId) return setError(t("Item ID is required.")), null;
    if (!Number.isFinite(weight) || weight <= 0) return setError(t("Quantity must be greater than 0.")), null;
    if (!Number.isFinite(price) || price <= 0) return setError(t("Price must be greater than 0.")), null;

    setError(null);
    return {
      productId: form.productId,
      name: trimmedName,
      itemId: trimmedItemId,
      itemQuantityOrWeight: weight,
      price,
      isBulk: false,
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
    setOpenRowMenuKey(null);
    setIsEditLivestockModalOpen(true);
  };

  const handleSubmitEditLivestock = () => {
    if (!editingLivestockId) return;
    const sourceItem = livestockItems.find((row) => resolveLivestockItemId(row) === editingLivestockId);
    const outletId = sourceItem ? resolveLivestockOutletId(sourceItem) : "";
    const trimmedName = editLivestockForm.name.trim();
    const trimmedItemId = editLivestockForm.itemId.trim();
    const weight = Number(editLivestockForm.weight);
    const price = Number(editLivestockForm.price);

    if (!editLivestockForm.productId) return setEditLivestockError(t("Please select live stock product category."));
    if (!trimmedName) return setEditLivestockError(t("Name is required."));
    if (!trimmedItemId) return setEditLivestockError(t("Item ID is required."));
    if (!Number.isFinite(weight) || weight <= 0) return setEditLivestockError(t("Quantity must be greater than 0."));
    if (!Number.isFinite(price) || price <= 0) return setEditLivestockError(t("Price must be greater than 0."));

    setEditLivestockError(null);
    updateLivestockMutation.mutate({
      id: editingLivestockId,
      name: trimmedName,
      itemId: trimmedItemId,
      productId: editLivestockForm.productId,
      outletId,
      itemQuantityOrWeight: weight,
      price,
      status: editLivestockForm.status === "Active",
      isBulk: editLivestockForm.isBulk,
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
    setAdjustIsBulk(item.isBulk === true);
    setOpenRowMenuKey(null);
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
    if (!Number.isFinite(amount) || amount <= 0) {
      setStockAdjustError(t("Amount must be greater than 0."));
      return;
    }
    setStockAdjustError(null);
    const payload = { livestockItemId: id, isBulk: adjustIsBulk, amount };
    if (stockAdjustModal.mode === "restock") {
      restockLivestockMutation.mutate(payload);
    } else {
      deductLivestockMutation.mutate(payload);
    }
  };

  const handleDelete = (item: LivestockItem) => {
    const productId = resolveLivestockItemId(item);
    if (!productId) {
      setRowActionError(t("Unable to delete this row because item ID is missing from API response."));
      return;
    }
    const confirmed = window.confirm(t("Are you sure you want to delete this live stock item?"));
    if (!confirmed) return;
    deleteLivestockMutation.mutate(productId);
  };

  const rowActionMutationsPending =
    updateLivestockMutation.isPending ||
    deleteLivestockMutation.isPending ||
    restockLivestockMutation.isPending ||
    deductLivestockMutation.isPending;

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
            {t("Restock Live Stock")}
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

      {rowActionError && <p className="productsMessage productsError">{rowActionError}</p>}

      <div className="productsTable">
        <div className="productsRow livestockRowWithActions livestockRowHeader">
          <span>{t("Product Category")}</span>
          <span>{t("Name")}</span>
          <span>{t("Item ID")}</span>
          <span>{t("Quantity")}</span>
          <span>{t("Price")}</span>
          <span>{t("Actions")}</span>
        </div>
        {(categoryLoading || livestockItemsLoading) && (
          <div className="productsRow livestockRowWithActions">
            <span className="productsMessage">{t("Loading…")}</span>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {categoryError && (
          <div className="productsRow livestockRowWithActions">
            <span className="productsMessage productsError">
              {categoryErrorDetail instanceof Error
                ? categoryErrorDetail.message
                : t("Failed to load livestock categories")}
            </span>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {livestockItemsError && (
          <div className="productsRow livestockRowWithActions">
            <span className="productsMessage productsError">
              {livestockItemsErrorDetail instanceof Error
                ? livestockItemsErrorDetail.message
                : t("Failed to load live stock items")}
            </span>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {!categoryLoading &&
          !categoryError &&
          !livestockItemsLoading &&
          !livestockItemsError &&
          filteredLivestockItems.length === 0 && (
            <div className="productsRow livestockRowWithActions">
              <span className="productsMessage">{t("No live stock items yet.")}</span>
              <span />
              <span />
              <span />
              <span />
              <span />
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
              className="productsRow livestockRowWithActions"
            >
              <span>{getLiveProductName(item.productId)}</span>
              <span>{item.name}</span>
              <span>{item.itemId}</span>
              <span>{item.weight}</span>
              <span>{item.price}</span>
              <div className="productsRowActions">
                <div
                  className={`rowActionMenu rowActionFloating${openRowMenuKey === rowKey ? " rowActionMenuOpen" : ""}`}
                  ref={openRowMenuKey === rowKey ? rowMenuButtonRef : undefined}
                >
                  <button
                    type="button"
                    className="rowMenuTrigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenRowMenuKey((k) => (k === rowKey ? null : rowKey));
                    }}
                    aria-label={t("More options")}
                    aria-expanded={openRowMenuKey === rowKey}
                    aria-haspopup="menu"
                  >
                    <MdMoreHoriz aria-hidden size={22} />
                  </button>
                  {openRowMenuKey === rowKey && (
                    <div className="rowMenuDropdown" role="menu">
                      <button
                        type="button"
                        className="rowMenuItem"
                        role="menuitem"
                        disabled={rowActionMutationsPending}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (rowActionMutationsPending) return;
                          setOpenRowMenuKey(null);
                          handleOpenEdit(item);
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
                          setOpenRowMenuKey(null);
                          openStockAdjustModal(item, "restock");
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
                          setOpenRowMenuKey(null);
                          openStockAdjustModal(item, "deduct");
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
                          setOpenRowMenuKey(null);
                          handleDelete(item);
                        }}
                      >
                        {t("Delete")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
          })}
      </div>

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

      <Modal
        isOpen={isLivestockModalOpen}
        title={t("Restock Live Stock")}
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
                Number(livestockForm.price) <= 0
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
            {t("Price")}
            <input
              type="number"
              min={0}
              step="any"
              value={livestockForm.price}
              onChange={(e) => setLivestockForm((prev) => ({ ...prev, price: e.target.value }))}
              className="productActionModalInput"
              placeholder={t("Enter price")}
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
                Number(editLivestockForm.price) <= 0
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
            {t("Price")}
            <input
              type="number"
              min={0}
              step="any"
              value={editLivestockForm.price}
              onChange={(e) => setEditLivestockForm((prev) => ({ ...prev, price: e.target.value }))}
              className="productActionModalInput"
              placeholder={t("Enter price")}
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
          <fieldset className="stockAdjustFieldset">
            <legend className="productActionModalLabel">{t("Amount measures")}</legend>
            <label className="stockAdjustRadioLabel">
              <input
                type="radio"
                name="editIsBulk"
                checked={editLivestockForm.isBulk}
                onChange={() => setEditLivestockForm((prev) => ({ ...prev, isBulk: true }))}
              />
              {t("Head count (bulk)")}
            </label>
            <label className="stockAdjustRadioLabel">
              <input
                type="radio"
                name="editIsBulk"
                checked={!editLivestockForm.isBulk}
                onChange={() => setEditLivestockForm((prev) => ({ ...prev, isBulk: false }))}
              />
              {t("Weight (kg)")}
            </label>
          </fieldset>
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
            ? t("Amount is subtracted using the same unit rules as restock (head count vs kg).")
            : t("Amount is added as head count when bulk, or as kg when not bulk.")
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
                Number(adjustAmount) <= 0
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
          <fieldset className="stockAdjustFieldset">
            <legend className="productActionModalLabel">{t("Amount measures")}</legend>
            <label className="stockAdjustRadioLabel">
              <input
                type="radio"
                name="adjustIsBulk"
                checked={adjustIsBulk}
                onChange={() => setAdjustIsBulk(true)}
              />
              {t("Head count (bulk)")}
            </label>
            <label className="stockAdjustRadioLabel">
              <input
                type="radio"
                name="adjustIsBulk"
                checked={!adjustIsBulk}
                onChange={() => setAdjustIsBulk(false)}
              />
              {t("Weight (kg)")}
            </label>
          </fieldset>
          <label className="productActionModalLabel">
            {t("Amount")}
            <input
              type="number"
              min={0}
              step="any"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              className="productActionModalInput"
              placeholder={adjustIsBulk ? t("Head count") : t("Kilograms")}
            />
          </label>
        </div>
      </Modal>
    </section>
  );
}
