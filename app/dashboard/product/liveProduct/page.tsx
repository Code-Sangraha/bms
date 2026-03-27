"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useI18n } from "@/app/providers/I18nProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import Modal from "@/app/components/Modal/Modal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import {
  createLivestockItem,
  deleteLivestockItem,
  getLivestockCategories,
  getLivestockItemsByProduct,
  updateLivestockItem,
  type LivestockItem,
} from "@/handlers/product";
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
};

const defaultLivestockForm: LivestockFormState = {
  productId: "",
  name: "",
  itemId: "",
  weight: "",
  price: "",
  status: "Active",
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

function resolveLivestockRowActionKey(item: LivestockItem, index: number): string {
  const withUnderscore = item as unknown as { _id?: unknown };
  if (typeof item.id === "string" && item.id) return `id:${item.id}`;
  if (typeof withUnderscore._id === "string" && withUnderscore._id) return `_id:${withUnderscore._id}`;
  return `fallback:${item.productId}:${item.itemId}:${index}`;
}

function toFormState(item: LivestockItem): LivestockFormState {
  return {
    productId: item.productId,
    name: item.name ?? "",
    itemId: item.itemId ?? "",
    weight: item.weight != null ? String(item.weight) : "",
    price: item.price != null ? String(item.price) : "",
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

export default function LiveProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [isLivestockModalOpen, setIsLivestockModalOpen] = useState(false);
  const [isEditLivestockModalOpen, setIsEditLivestockModalOpen] = useState(false);
  const [livestockError, setLivestockError] = useState<string | null>(null);
  const [editLivestockError, setEditLivestockError] = useState<string | null>(null);
  const [rowActionError, setRowActionError] = useState<string | null>(null);
  const [livestockForm, setLivestockForm] = useState<LivestockFormState>(defaultLivestockForm);
  const [editLivestockForm, setEditLivestockForm] = useState<LivestockFormState>(defaultLivestockForm);
  const [editingLivestockId, setEditingLivestockId] = useState<string | null>(null);

  const {
    data: livestockCategories = [],
    isLoading: categoryLoading,
    isError: categoryError,
    error: categoryErrorDetail,
  } = useQuery({
    queryKey: LIVESTOCK_CATEGORY_QUERY_KEY,
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
      for (const result of results) {
        if (!result.ok) {
          if (result.status === 401) navigate("/login");
          throw new Error(result.error);
        }
        merged.push(...result.data.map(toNormalizedItem));
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
    const q = searchQuery.trim().toLowerCase();
    if (!q) return livestockItems;
    return livestockItems.filter((item) => {
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
  }, [livestockItems, livestockCategories, searchQuery]);

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

  const paginatedLivestockItems = useMemo(
    () => paginate(orderedLivestockItems, startIndex, endIndex),
    [orderedLivestockItems, startIndex, endIndex]
  );

  const getLiveProductName = (productId: string) =>
    livestockCategories.find((product) => product.id === productId)?.name ?? productId;

  const livestockMutation = useMutation({
    mutationFn: createLivestockItem,
    onSuccess: (result, variables) => {
      setLivestockError(null);
      if (!result.ok) {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        setLivestockError(result.error ?? t("Failed to add live stock item"));
        return;
      }
      const optimisticItem: LivestockItem = {
        id: result.data?.data?.id ?? result.data?.item?.id ?? `${variables.productId}-${variables.itemId}-${Date.now()}`,
        productId: variables.productId,
        name: variables.name,
        itemId: variables.itemId,
        weight: variables.itemQuantityOrWeight,
        itemQuantityOrWeight: variables.itemQuantityOrWeight,
        isBulk: variables.isBulk,
        price: variables.price,
        status: variables.status,
      };
      queryClient.setQueryData<LivestockItem[]>(
        [...LIVESTOCK_ITEMS_QUERY_KEY, liveStockProductIds],
        (old) => [optimisticItem, ...(old ?? [])]
      );
      setIsLivestockModalOpen(false);
      setLivestockForm(defaultLivestockForm);
    },
    onError: () => {
      setLivestockError(t("Something went wrong. Please try again."));
    },
  });

  const updateLivestockMutation = useMutation({
    mutationFn: updateLivestockItem,
    onSuccess: (result, variables) => {
      setEditLivestockError(null);
      if (!result.ok) {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        setEditLivestockError(result.error ?? t("Failed to update live stock item"));
        return;
      }
      queryClient.setQueryData<LivestockItem[]>(
        [...LIVESTOCK_ITEMS_QUERY_KEY, liveStockProductIds],
        (old) =>
          (old ?? []).map((item) => {
            const id = resolveLivestockItemId(item);
            if (id !== variables.id) return item;
            return {
              ...item,
              ...variables,
              weight: variables.itemQuantityOrWeight,
              itemQuantityOrWeight: variables.itemQuantityOrWeight,
            };
          })
      );
      setIsEditLivestockModalOpen(false);
      setEditingLivestockId(null);
      setEditLivestockForm(defaultLivestockForm);
    },
    onError: () => {
      setEditLivestockError(t("Something went wrong. Please try again."));
    },
  });

  const deleteLivestockMutation = useMutation({
    mutationFn: (id: string) => deleteLivestockItem({ id }),
    onSuccess: (result, id) => {
      if (!result.ok) {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        setRowActionError(result.error ?? t("Failed to delete live stock item"));
        return;
      }
      setRowActionError(null);
      queryClient.setQueryData<LivestockItem[]>(
        [...LIVESTOCK_ITEMS_QUERY_KEY, liveStockProductIds],
        (old) => (old ?? []).filter((item) => resolveLivestockItemId(item) !== id)
      );
    },
    onError: () => {
      setRowActionError(t("Something went wrong. Please try again."));
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
      isBulk: true,
      status: true,
    };
  };

  const handleSubmitLivestock = () => {
    const payload = validateLivestockForm(livestockForm, setLivestockError);
    if (!payload) return;
    livestockMutation.mutate(payload);
  };

  const handleSubmitEditLivestock = () => {
    if (!editingLivestockId) return;
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
      itemQuantityOrWeight: weight,
      price,
      status: editLivestockForm.status === "Active",
    });
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

  const handleDelete = (item: LivestockItem) => {
    const id = resolveLivestockItemId(item);
    if (!id) {
      setRowActionError(t("Unable to delete this row because item ID is missing from API response."));
      return;
    }
    const confirmed = window.confirm(t("Are you sure you want to delete this live stock item?"));
    if (!confirmed) return;
    deleteLivestockMutation.mutate(id);
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
            {t("Restock Live Stock")}
          </button>
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
                <button
                  type="button"
                  className="productActionBtn productActionRestock"
                  onClick={() => handleOpenEdit(item)}
                  disabled={updateLivestockMutation.isPending || deleteLivestockMutation.isPending}
                >
                  {t("Edit")}
                </button>
                <button
                  type="button"
                  className="productActionBtn productActionDeduct"
                  onClick={() => handleDelete(item)}
                  disabled={updateLivestockMutation.isPending || deleteLivestockMutation.isPending}
                >
                  {t("Delete")}
                </button>
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
        </div>
      </Modal>
    </section>
  );
}
