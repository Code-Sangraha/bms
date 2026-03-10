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
  getLivestockItemsByProduct,
  getProducts,
  updateLivestockItem,
  type CreateLivestockItemPayload,
  type LivestockItem,
} from "@/handlers/product";
import { getProductTypes } from "@/handlers/productType";
import "./liveProduct.scss";

const LIVE_PRODUCT_TYPE_NAMES = ["live stock", "live"];
const PRODUCTS_QUERY_KEY = ["products"];
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
    data: products = [],
    isLoading: productsLoading,
    isError: productsError,
    error: productsErrorDetail,
  } = useQuery({
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
    queryKey: ["productTypes"],
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
      products.filter((p) => {
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
        liveStockProducts.find((product) => product.id === item.productId)?.name.toLowerCase() ?? "";
      return (
        item.name.toLowerCase().includes(q) ||
        item.itemId.toLowerCase().includes(q) ||
        String(item.weight).includes(q) ||
        String(item.price).includes(q) ||
        productName.includes(q)
      );
    });
  }, [livestockItems, liveStockProducts, searchQuery]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(filteredLivestockItems.length, { defaultPageSize: 10 });

  const paginatedLivestockItems = useMemo(
    () => paginate(filteredLivestockItems, startIndex, endIndex),
    [filteredLivestockItems, startIndex, endIndex]
  );

  const getLiveProductName = (productId: string) =>
    liveStockProducts.find((product) => product.id === productId)?.name ?? productId;

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
        weight: variables.weight,
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
    if (!Number.isFinite(weight) || weight <= 0) return setError(t("Weight must be greater than 0.")), null;
    if (!Number.isFinite(price) || price <= 0) return setError(t("Price must be greater than 0.")), null;

    setError(null);
    return {
      productId: form.productId,
      name: trimmedName,
      itemId: trimmedItemId,
      weight,
      price,
      status: form.status === "Active",
    };
  };

  const handleSubmitLivestock = () => {
    const payload = validateLivestockForm(livestockForm, setLivestockError);
    if (!payload) return;
    livestockMutation.mutate(payload as CreateLivestockItemPayload);
  };

  const handleSubmitEditLivestock = () => {
    if (!editingLivestockId) return;
    const payload = validateLivestockForm(editLivestockForm, setEditLivestockError);
    if (!payload) return;
    updateLivestockMutation.mutate({ id: editingLivestockId, ...payload });
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
            {t("Add Live Stock Item")}
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
          <span>{t("Weight")}</span>
          <span>{t("Price")}</span>
          <span>{t("Status")}</span>
          <span>{t("Actions")}</span>
        </div>
        {(productsLoading || livestockItemsLoading) && (
          <div className="productsRow livestockRowWithActions">
            <span className="productsMessage">{t("Loading…")}</span>
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {productsError && (
          <div className="productsRow livestockRowWithActions">
            <span className="productsMessage productsError">
              {productsErrorDetail instanceof Error
                ? productsErrorDetail.message
                : t("Failed to load products")}
            </span>
            <span />
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
            <span />
          </div>
        )}
        {!productsLoading && !productsError && liveTypeIds.size === 0 && productTypes.length > 0 && (
          <div className="productsRow livestockRowWithActions">
            <span className="productsMessage">{t('No product type named "Live Stock" found.')}</span>
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {!productsLoading &&
          !productsError &&
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
              <span />
            </div>
          )}
        {!productsLoading &&
          !productsError &&
          !livestockItemsLoading &&
          !livestockItemsError &&
          paginatedLivestockItems.map((item) => (
            <div
              key={resolveLivestockItemId(item) ?? `${item.productId}-${item.itemId}`}
              className="productsRow livestockRowWithActions"
            >
              <span>{getLiveProductName(item.productId)}</span>
              <span>{item.name}</span>
              <span>{item.itemId}</span>
              <span>{item.weight}</span>
              <span>{item.price}</span>
              <span>
                <span className={item.status ? "badge badgeActive" : "badge"}>
                  {item.status ? t("Active") : t("Inactive")}
                </span>
              </span>
              <span className="productsRowActions">
                <button
                  type="button"
                  className="productActionBtn productActionRestock"
                  onClick={() => handleOpenEdit(item)}
                  disabled={updateLivestockMutation.isPending}
                >
                  {t("Edit")}
                </button>
                <button
                  type="button"
                  className="productActionBtn productActionDeduct"
                  onClick={() => handleDelete(item)}
                  disabled={deleteLivestockMutation.isPending}
                >
                  {t("Delete")}
                </button>
              </span>
            </div>
          ))}
      </div>

      {!productsLoading &&
        !productsError &&
        !livestockItemsLoading &&
        !livestockItemsError &&
        filteredLivestockItems.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredLivestockItems.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            pageSizeOptions={[10, 20, 50]}
            onPageSizeChange={setPageSize}
          />
        )}

      <Modal
        isOpen={isLivestockModalOpen}
        title={t("Add Live Stock Item")}
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
              {liveStockProducts.map((product) => (
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
            {t("Weight")}
            <input
              type="number"
              min={0}
              step="any"
              value={livestockForm.weight}
              onChange={(e) => setLivestockForm((prev) => ({ ...prev, weight: e.target.value }))}
              className="productActionModalInput"
              placeholder={t("Enter weight")}
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
          <label className="productActionModalLabel">
            {t("Status")}
            <select
              value={livestockForm.status}
              onChange={(e) =>
                setLivestockForm((prev) => ({
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
              {liveStockProducts.map((product) => (
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
            {t("Weight")}
            <input
              type="number"
              min={0}
              step="any"
              value={editLivestockForm.weight}
              onChange={(e) => setEditLivestockForm((prev) => ({ ...prev, weight: e.target.value }))}
              className="productActionModalInput"
              placeholder={t("Enter weight")}
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
