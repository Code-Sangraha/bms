"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MdMoreHoriz } from "react-icons/md";
import { useI18n } from "@/app/providers/I18nProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import Modal from "@/app/components/Modal/Modal";
import ConfirmModal from "@/app/components/Modal/ConfirmModal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import {
  deleteProduct as deleteProductApi,
  deductProduct,
  getProcessedOpeningStock,
  getProducts,
  restockProduct,
  updateProduct as updateProductApi,
  type Product,
} from "@/handlers/product";
import OpeningStockTable from "../liveProduct/components/OpeningStockTable";
import ClosingStockTable from "../liveProduct/components/ClosingStockTable";
import type { ProcessedDetailLocationState } from "@/app/dashboard/product/lib/inventoryDetailTypes";
import { getOutlets } from "@/handlers/outlet";
import { getProductTypes } from "@/handlers/productType";
import { type CreateProductFormValues } from "@/schema/product";
import { computeRowMenuPosition, ROW_MENU_HEIGHT_ESTIMATE_PX } from "@/lib/rowMenuPosition";
import ProductEditModal from "../ProductEditModal";
import "./processedProduct.scss";

const PRODUCT_TYPE_NAME = "Processed";
const PRODUCTS_QUERY_KEY = ["products"];

function getProcessedStock(product: Product): number {
  const raw = product.quantity ?? product.weight;
  const num = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function formatProcessedQuantityDisplay(product: Product): string {
  const q = product.quantity;
  if (q != null && Number.isFinite(Number(q))) {
    return String(q);
  }
  return "—";
}

function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type OpenRowMenuState = {
  rowKey: string;
  product: Product;
  placement: "above" | "below";
  top: number;
  bottom: number;
  right: number;
};

export default function ProcessedProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOutletId, setSelectedOutletId] = useState("all");
  const [openRowMenu, setOpenRowMenu] = useState<OpenRowMenuState | null>(null);
  const rowMenuButtonRef = useRef<HTMLDivElement>(null);
  const rowMenuPortalRef = useRef<HTMLDivElement>(null);

  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [restockWeight, setRestockWeight] = useState("");
  const [restockError, setRestockError] = useState<string | null>(null);

  const [deductTarget, setDeductTarget] = useState<Product | null>(null);
  const [deductWeight, setDeductWeight] = useState("");
  const [deductError, setDeductError] = useState<string | null>(null);

  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [openingStockFrom, setOpeningStockFrom] = useState(() => toIsoDateLocal(new Date()));
  const [openingStockTo, setOpeningStockTo] = useState(() => toIsoDateLocal(new Date()));
  const openingStockRangeInvalid = openingStockFrom > openingStockTo;

  const { data: products = [], isLoading: productsLoading, isError: productsError, error: productsErrorDetail } = useQuery({
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

  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: async () => {
      const result = await getOutlets();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const processedTypeId = useMemo(
    () => productTypes.find((pt) => pt.name.toLowerCase() === PRODUCT_TYPE_NAME.toLowerCase())?.id ?? null,
    [productTypes]
  );

  const filteredProducts = useMemo(() => {
    let list: Product[] = processedTypeId
      ? products.filter((p) => p.productTypeId === processedTypeId)
      : [];
    if (selectedOutletId !== "all") {
      list = list.filter((p) => p.outletId === selectedOutletId);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const outletNames = new Map(outlets.map((o) => [o.id, o.name.toLowerCase()]));
      const typeNames = new Map(productTypes.map((pt) => [pt.id, pt.name.toLowerCase()]));
      list = list.filter((p) => {
        const name = p.name.toLowerCase();
        const outletName = outletNames.get(p.outletId) ?? "";
        const typeName = typeNames.get(p.productTypeId) ?? "";
        return name.includes(q) || outletName.includes(q) || typeName.includes(q);
      });
    }
    return list;
  }, [products, processedTypeId, selectedOutletId, searchQuery, outlets, productTypes]);

  const getOutletName = (outletId: string) => outlets.find((o) => o.id === outletId)?.name ?? outletId;
  const getTypeName = (typeId: string) => productTypes.find((pt) => pt.id === typeId)?.name ?? typeId;

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(filteredProducts.length, { defaultPageSize: 10 });
  const paginatedProducts = useMemo(
    () => paginate(filteredProducts, startIndex, endIndex),
    [filteredProducts, startIndex, endIndex]
  );

  const closeRowMenu = useCallback(() => {
    setOpenRowMenu(null);
  }, []);

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
  }, [openRowMenu?.rowKey]);

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

  const invalidateProducts = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
  }, [queryClient]);

  const {
    data: processedOpeningStockData,
    isPending: processedOpeningStockPending,
    isError: processedOpeningStockError,
    error: processedOpeningStockErrorDetail,
  } = useQuery({
    queryKey: ["processedOpeningStock", openingStockFrom, openingStockTo],
    enabled: !openingStockRangeInvalid,
    staleTime: 60_000,
    queryFn: async () => {
      const result = await getProcessedOpeningStock(openingStockFrom, openingStockTo);
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const processedOpeningStockErrorMessage = processedOpeningStockError
    ? processedOpeningStockErrorDetail instanceof Error && processedOpeningStockErrorDetail.message.trim()
      ? processedOpeningStockErrorDetail.message
      : t("Opening stock data is not available yet.")
    : null;

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: CreateProductFormValues }) =>
      updateProductApi(id, values, { isProcessed: true }),
    onSuccess: (result) => {
      if (result.ok) {
        setProductToEdit(null);
        invalidateProducts();
      } else if (result.status === 401) {
        navigate("/login");
      }
    },
  });

  const restockMutation = useMutation({
    mutationFn: restockProduct,
    onSuccess: (result) => {
      setRestockError(null);
      if (result.ok) {
        setRestockTarget(null);
        setRestockWeight("");
        invalidateProducts();
      } else {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        setRestockError(result.error ?? t("Restock failed"));
      }
    },
  });

  const deductMutation = useMutation({
    mutationFn: deductProduct,
    onSuccess: (result) => {
      setDeductError(null);
      if (result.ok) {
        setDeductTarget(null);
        setDeductWeight("");
        invalidateProducts();
      } else {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        setDeductError(result.error ?? t("Deduct failed"));
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProductApi(id),
    onSuccess: (result) => {
      if (result.ok) {
        setProductToDelete(null);
        invalidateProducts();
      } else if (result.status === 401) {
        navigate("/login");
      }
    },
  });

  const rowMutationsPending =
    updateMutation.isPending ||
    restockMutation.isPending ||
    deductMutation.isPending ||
    deleteMutation.isPending;

  const handleEditSave = (values: CreateProductFormValues) => {
    if (productToEdit) {
      updateMutation.mutate({ id: productToEdit.id, values });
    }
  };

  const handleSubmitRestock = () => {
    if (!restockTarget) return;
    const w = Number(restockWeight);
    if (!Number.isFinite(w) || w <= 0) return;
    restockMutation.mutate({
      id: restockTarget.id,
      outletId: restockTarget.outletId,
      weight: w,
    });
  };

  const handleSubmitDeduct = () => {
    if (!deductTarget) return;
    const w = Number(deductWeight);
    if (!Number.isFinite(w) || w <= 0) return;
    const cap = getProcessedStock(deductTarget);
    if (w > cap) {
      setDeductError(t("Deduct amount cannot exceed current stock."));
      return;
    }
    setDeductError(null);
    deductMutation.mutate({ id: deductTarget.id, weight: w });
  };

  const handleConfirmDelete = () => {
    if (productToDelete) deleteMutation.mutate(productToDelete.id);
  };

  return (
    <section className="processedProductPage">
      <div className="breadcrumb">
        <span>{t("Product")}</span> {"›"} {t("Processed")}
      </div>

      <div className="processedProductHeader">
        <div className="processedProductHeaderText">
          <h1 className="pageTitle">{t("Processed Products")}</h1>
          <p className="pageSubtitle">{t("Products of type Processed")}</p>
        </div>
        <div className="processedProductFilters">
          <label className="processedProductOutletFilter">
            <span className="processedProductOutletLabel">{t("Outlet")}</span>
            <select
              className="processedProductOutletSelect"
              value={selectedOutletId}
              onChange={(e) => {
                setSelectedOutletId(e.target.value);
                setCurrentPage(1);
              }}
              aria-label={t("Filter by outlet")}
            >
              <option value="all">{t("All Outlets")}</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </select>
          </label>
          <div className="processedProductSearch">
            <span className="searchIcon">🔍</span>
            <input
              className="searchInput"
              placeholder={t("Search")}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              aria-label={t("Search processed products")}
            />
          </div>
        </div>
      </div>

      <div className="productsTable">
        <div className="productsRow productsRowHeader">
          <span>{t("Name")}</span>
          <span>{t("Product Type")}</span>
          <span>{t("Outlet")}</span>
          <span>{t("Quantity")}</span>
          <span>{t("Actions")}</span>
        </div>
        {productsLoading && (
          <div className="productsRow">
            <span className="productsMessage">{t("Loading…")}</span>
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {productsError && (
          <div className="productsRow">
            <span className="productsMessage productsError">
              {productsErrorDetail instanceof Error
                ? productsErrorDetail.message
                : t("Failed to load products")}
            </span>
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {!productsLoading && !productsError && !processedTypeId && productTypes.length > 0 && (
          <div className="productsRow">
            <span className="productsMessage">{t('No product type named "Processed" found.')}</span>
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {!productsLoading &&
          !productsError &&
          processedTypeId &&
          filteredProducts.length === 0 && (
            <div className="productsRow">
              <span className="productsMessage">
                {searchQuery.trim()
                  ? `${t("No processed products match")} "${searchQuery.trim()}".`
                  : t("No processed products yet.")}
              </span>
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
        {!productsLoading &&
          !productsError &&
          filteredProducts.length > 0 &&
          paginatedProducts.map((product) => {
            const rowKey = product.id;
            return (
              <div key={rowKey} className="productsRow processedRowWithActions">
                <span>{product.name}</span>
                <span>{getTypeName(product.productTypeId)}</span>
                <span>{getOutletName(product.outletId)}</span>
                <span>{formatProcessedQuantityDisplay(product)}</span>
                <div className="productsRowActions">
                  <div
                    className={`rowActionMenu rowActionFloating${openRowMenu?.rowKey === rowKey ? " rowActionMenuOpen" : ""}`}
                    ref={openRowMenu?.rowKey === rowKey ? rowMenuButtonRef : undefined}
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
                            product,
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
              </div>
            );
          })}
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
              disabled={rowMutationsPending}
              onMouseDown={(e) => {
                e.preventDefault();
                if (rowMutationsPending) return;
                closeRowMenu();
                setProductToEdit(openRowMenu.product);
              }}
            >
              {t("Edit")}
            </button>
            <button
              type="button"
              className="rowMenuItem"
              role="menuitem"
              disabled={rowMutationsPending}
              onMouseDown={(e) => {
                e.preventDefault();
                if (rowMutationsPending) return;
                closeRowMenu();
                navigate(
                  `/dashboard/product/processedProduct/${encodeURIComponent(openRowMenu.product.id)}`,
                  {
                    state: {
                      productSnapshot: openRowMenu.product,
                    } satisfies ProcessedDetailLocationState,
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
              disabled={rowMutationsPending}
              onMouseDown={(e) => {
                e.preventDefault();
                if (rowMutationsPending) return;
                closeRowMenu();
                setRestockTarget(openRowMenu.product);
                setRestockWeight("");
                setRestockError(null);
              }}
            >
              {t("Restock")}
            </button>
            <button
              type="button"
              className="rowMenuItem"
              role="menuitem"
              disabled={rowMutationsPending}
              onMouseDown={(e) => {
                e.preventDefault();
                if (rowMutationsPending) return;
                closeRowMenu();
                setDeductTarget(openRowMenu.product);
                setDeductWeight("");
                setDeductError(null);
              }}
            >
              {t("Deduct")}
            </button>
            <button
              type="button"
              className="rowMenuItem rowMenuItemDelete"
              role="menuitem"
              disabled={rowMutationsPending}
              onMouseDown={(e) => {
                e.preventDefault();
                if (rowMutationsPending) return;
                closeRowMenu();
                setProductToDelete(openRowMenu.product);
              }}
            >
              {t("Delete")}
            </button>
          </div>,
          document.body
        )}

      {!productsLoading && !productsError && filteredProducts.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredProducts.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          pageSizeOptions={[10, 20, 50]}
          onPageSizeChange={setPageSize}
        />
      )}

      <section className="openingClosingStockSection" aria-labelledby="processed-opening-closing-heading">
        <h2 id="processed-opening-closing-heading" className="pageTitle" style={{ fontSize: "18px", margin: 0 }}>
          {t("Processed products opening and closing")}
        </h2>
        <div className="openingClosingStockDateRow">
          <div className="openingClosingStockDateField">
            <label className="openingClosingStockDateLabel" htmlFor="processed-opening-stock-from">
              {t("Date from")}
            </label>
            <input
              id="processed-opening-stock-from"
              type="date"
              className="openingClosingStockDateInput"
              value={openingStockFrom}
              onChange={(e) => setOpeningStockFrom(e.target.value)}
            />
          </div>
          <div className="openingClosingStockDateField">
            <label className="openingClosingStockDateLabel" htmlFor="processed-opening-stock-to">
              {t("Date to")}
            </label>
            <input
              id="processed-opening-stock-to"
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
              openingStockData={processedOpeningStockData}
              isPending={processedOpeningStockPending}
              isError={processedOpeningStockError}
              errorMessage={processedOpeningStockErrorMessage}
            />
            <ClosingStockTable
              from={openingStockFrom}
              to={openingStockTo}
              openingStockData={processedOpeningStockData}
              isPending={processedOpeningStockPending}
              isError={processedOpeningStockError}
              errorMessage={processedOpeningStockErrorMessage}
            />
          </div>
        )}
      </section>

      {productToEdit && (
        <ProductEditModal
          isOpen
          product={productToEdit}
          productTypes={productTypes}
          outlets={outlets}
          onClose={() => setProductToEdit(null)}
          onSave={handleEditSave}
          loading={updateMutation.isPending}
        />
      )}

      <Modal
        isOpen={!!restockTarget}
        title={t("Restock processed product")}
        subtitle={restockTarget?.name ?? ""}
        onClose={() => {
          setRestockTarget(null);
          setRestockWeight("");
          setRestockError(null);
        }}
        footer={
          restockTarget ? (
            <div className="productActionModalFooter">
              <button
                type="button"
                className="productActionModalCancel"
                onClick={() => {
                  setRestockTarget(null);
                  setRestockWeight("");
                  setRestockError(null);
                }}
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                className="productActionModalSubmit"
                onClick={handleSubmitRestock}
                disabled={
                  !restockWeight ||
                  !Number.isFinite(Number(restockWeight)) ||
                  Number(restockWeight) <= 0 ||
                  restockMutation.isPending
                }
              >
                {restockMutation.isPending ? t("Saving…") : t("Restock")}
              </button>
            </div>
          ) : null
        }
      >
        {restockTarget && (
          <div className="productActionModalBody">
            {restockError && <p className="productActionModalError">{restockError}</p>}
            <label className="productActionModalLabel">
              {t("Weight")}
              <input
                type="number"
                min={1}
                step="any"
                value={restockWeight}
                onChange={(e) => setRestockWeight(e.target.value)}
                className="productActionModalInput"
                placeholder={t("Enter weight")}
              />
            </label>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!deductTarget}
        title={t("Deduct processed stock")}
        subtitle={deductTarget?.name ?? ""}
        onClose={() => {
          setDeductTarget(null);
          setDeductWeight("");
          setDeductError(null);
        }}
        footer={
          deductTarget ? (
            <div className="productActionModalFooter">
              <button
                type="button"
                className="productActionModalCancel"
                onClick={() => {
                  setDeductTarget(null);
                  setDeductWeight("");
                  setDeductError(null);
                }}
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                className="productActionModalSubmit"
                onClick={handleSubmitDeduct}
                disabled={
                  !deductWeight ||
                  !Number.isFinite(Number(deductWeight)) ||
                  Number(deductWeight) <= 0 ||
                  (deductTarget !== null && Number(deductWeight) > getProcessedStock(deductTarget)) ||
                  deductMutation.isPending
                }
              >
                {deductMutation.isPending ? t("Saving…") : t("Deduct")}
              </button>
            </div>
          ) : null
        }
      >
        {deductTarget && (
          <div className="productActionModalBody">
            {deductError && <p className="productActionModalError">{deductError}</p>}
            <p className="productActionModalHint">
              {t("Current stock")}: {getProcessedStock(deductTarget)}
            </p>
            <label className="productActionModalLabel">
              {t("Weight")}
              <input
                type="number"
                min={1}
                step="any"
                value={deductWeight}
                onChange={(e) => {
                  setDeductWeight(e.target.value);
                  setDeductError(null);
                }}
                className="productActionModalInput"
                placeholder={t("Enter weight")}
              />
            </label>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!productToDelete}
        title={t("Delete processed product")}
        message={
          productToDelete
            ? `${t("Are you sure you want to delete this processed product?")} (${productToDelete.name}). ${t("This cannot be undone.")}`
            : ""
        }
        confirmLabel={t("Delete")}
        cancelLabel={t("Cancel")}
        variant="danger"
        loading={deleteMutation.isPending}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </section>
  );
}
