"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MdMoreHoriz } from "react-icons/md";
import { useI18n } from "@/app/providers/I18nProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import Modal from "@/app/components/Modal/Modal";
import ConfirmModal from "@/app/components/Modal/ConfirmModal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import {
  deleteProduct as deleteProductApi,
  deductProduct,
  getProcessedInventoryHistory,
  getProcessedOpeningStock,
  getProducts,
  updateProduct as updateProductApi,
  type Product,
} from "@/handlers/product";
import OpeningStockTable from "../liveProduct/components/OpeningStockTable";
import ClosingStockTable from "../liveProduct/components/ClosingStockTable";
import {
  buildProcessedOpeningStockData,
  type ProcessedClientStockMode,
} from "./lib/buildProcessedOpeningStockData";
import { getProcessedStockWeight } from "./lib/processedStockWeight";
import type { ProcessedDetailLocationState } from "@/app/dashboard/product/lib/inventoryDetailTypes";
import { getOutlets } from "@/handlers/outlet";
import { getProductTypes } from "@/handlers/productType";
import { type CreateProductFormValues } from "@/schema/product";
import { computeRowMenuPosition, ROW_MENU_HEIGHT_ESTIMATE_PX } from "@/lib/rowMenuPosition";
import ProductEditModal from "../ProductEditModal";
import "./processedProduct.scss";

const PRODUCT_TYPE_NAME = "Processed";
const PRODUCTS_QUERY_KEY = ["products"];

/** Dev: set `localStorage.setItem('DEBUG_PROCESSED_STOCK','1')` then refresh. */
function shouldLogProcessedOpeningStockDebug(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("DEBUG_PROCESSED_STOCK") === "1";
  } catch {
    return false;
  }
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

/** Stored stock weight for processed products (backend increments `weight` on complete processing). */
function formatProcessedWeightDisplay(product: Product): string {
  const w = product.weight;
  if (w != null && Number.isFinite(Number(w))) return String(w);
  const q = product.quantity;
  if (q != null && Number.isFinite(Number(q))) return String(q);
  return "—";
}

// /** Waste weight when the API exposes it on the product; otherwise em dash. */
// function formatProcessedWasteWeightDisplay(product: Product): string {
//   const waste = product.wasteWeight;
//   if (waste != null && Number.isFinite(Number(waste))) return String(waste);
//   return "—";
// }

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

type ProcessedProductMainTab = "inventory" | "openingClosing";

export default function ProcessedProductPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { isScoped, rowFilterOutletId } = useRowFilterOutletId();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOutletId, setSelectedOutletId] = useState("all");

  useEffect(() => {
    if (isScoped && rowFilterOutletId) setSelectedOutletId(rowFilterOutletId);
  }, [isScoped, rowFilterOutletId]);

  const effectiveSelectedOutletId =
    isScoped && rowFilterOutletId ? rowFilterOutletId : selectedOutletId;
  const [openRowMenu, setOpenRowMenu] = useState<OpenRowMenuState | null>(null);
  const rowMenuButtonRef = useRef<HTMLDivElement>(null);
  const rowMenuPortalRef = useRef<HTMLDivElement>(null);
  const [mainTab, setMainTab] = useState<ProcessedProductMainTab>("inventory");

  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

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
    if (effectiveSelectedOutletId !== "all") {
      list = list.filter((p) => p.outletId === effectiveSelectedOutletId);
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
  }, [products, processedTypeId, effectiveSelectedOutletId, searchQuery, outlets, productTypes]);

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
    queryClient.invalidateQueries({ queryKey: ["processedInventoryHistory"] });
    queryClient.invalidateQueries({ queryKey: ["processedOpeningStock"] });
    queryClient.invalidateQueries({ queryKey: ["salesByProductId"] });
  }, [queryClient]);

  const todayIso = toIsoDateLocal(new Date());
  const clientStockMode: ProcessedClientStockMode =
    openingStockTo === todayIso ? "reconciled" : "movementOnly";

  const filteredProductIdsKey = useMemo(
    () =>
      [...filteredProducts]
        .map((p) => p.id)
        .sort()
        .join(","),
    [filteredProducts]
  );

  const {
    data: processedOpeningStockServer,
    isPending: processedOpeningStockServerPending,
    isError: processedOpeningStockServerError,
    isSuccess: processedOpeningStockServerSuccess,
  } = useQuery({
    queryKey: ["processedOpeningStock", openingStockFrom, openingStockTo],
    enabled: mainTab === "openingClosing" && !openingStockRangeInvalid,
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

  const {
    data: processedHistoryForOpening,
    isPending: processedHistoryOpeningPending,
    isError: processedHistoryOpeningError,
    error: processedHistoryOpeningErrorDetail,
  } = useQuery({
    queryKey: [
      "processedInventoryHistory",
      "openingClosingRange",
      openingStockFrom,
      openingStockTo,
      clientStockMode,
      filteredProductIdsKey,
    ],
    enabled:
      mainTab === "openingClosing" &&
      !openingStockRangeInvalid &&
      filteredProducts.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const todayLocal = toIsoDateLocal(new Date());
      const toDate = clientStockMode === "reconciled" ? todayLocal : openingStockTo;
      const result = await getProcessedInventoryHistory({
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

  const historyRowsForOpening = processedHistoryForOpening ?? [];

  const historyFilteredForOpening = useMemo(() => {
    const ids = new Set(filteredProducts.map((p) => p.id.trim()).filter(Boolean));
    return historyRowsForOpening.filter((h) => ids.has(h.productId.trim()));
  }, [historyRowsForOpening, filteredProducts]);

  const clientProcessedOpeningStockData = useMemo(
    () =>
      buildProcessedOpeningStockData({
        from: openingStockFrom,
        to: openingStockTo,
        products: filteredProducts,
        history: historyFilteredForOpening,
        mode: clientStockMode,
      }),
    [
      openingStockFrom,
      openingStockTo,
      filteredProducts,
      historyFilteredForOpening,
      clientStockMode,
    ]
  );

  const serverOpeningAuthoritative = useMemo(() => {
    const s = processedOpeningStockServer;
    if (!s || s.openingStockByDate.length === 0) return false;
    return (
      (s.totalRecords ?? 0) > 0 ||
      s.openingStockByDate.some(
        (d) =>
          d.totalAdded > 0 ||
          d.totalConsumed > 0 ||
          d.totalOpening != null ||
          d.totalClosing != null ||
          d.items.some(
            (i) =>
              i.addedQuantity > 0 ||
              i.consumedQuantity > 0 ||
              i.openingQuantity != null ||
              i.closingQuantity != null
          )
      )
    );
  }, [processedOpeningStockServer]);

  const mergedOpeningStockData = useMemo(() => {
    if (serverOpeningAuthoritative && processedOpeningStockServer) {
      return processedOpeningStockServer;
    }
    return clientProcessedOpeningStockData;
  }, [serverOpeningAuthoritative, processedOpeningStockServer, clientProcessedOpeningStockData]);

  const dataSourceIsClient = mergedOpeningStockData === clientProcessedOpeningStockData;

  const openingStockPending =
    mainTab === "openingClosing" &&
    !openingStockRangeInvalid &&
    (processedHistoryOpeningPending ||
      processedOpeningStockServerPending ||
      (filteredProducts.length > 0 && productsLoading));

  const openingStockError =
    processedHistoryOpeningError && !serverOpeningAuthoritative;

  const openingStockErrorMessage = openingStockError
    ? processedHistoryOpeningErrorDetail instanceof Error &&
      processedHistoryOpeningErrorDetail.message.trim()
      ? processedHistoryOpeningErrorDetail.message
      : t("Could not load processed movement history.")
    : null;

  useEffect(() => {
    if (!shouldLogProcessedOpeningStockDebug()) return;
    if (mainTab !== "openingClosing") return;
    if (openingStockRangeInvalid) return;

    const toDateSent =
      clientStockMode === "reconciled" ? toIsoDateLocal(new Date()) : openingStockTo;

    const hist = historyRowsForOpening;
    const historyRowsInUiRange = hist.filter((h) => {
      const day = localCalendarDayFromCreatedAt(h.createdAt);
      return day >= openingStockFrom && day <= openingStockTo;
    });

    console.groupCollapsed("[processed-opening-stock] filters & API request");
    console.log("UI date range (what the tables use)", {
      from: openingStockFrom,
      to: openingStockTo,
      clientStockMode,
    });
    console.log("GET /products/processed/history query", {
      fromDate: openingStockFrom,
      toDate: toDateSent,
      note:
        clientStockMode === "reconciled"
          ? "toDate is extended to today so post-range rows can anchor closing."
          : "toDate matches UI end date.",
    });
    console.log("GET /products/processed/opening-stock", {
      from: openingStockFrom,
      to: openingStockTo,
    });
    console.log("Inventory filter", {
      filteredProductCount: filteredProducts.length,
      selectedOutletId: effectiveSelectedOutletId,
      searchQuery: searchQuery.trim() || "(empty)",
    });
    console.log("Fetch state", {
      historyPending: processedHistoryOpeningPending,
      historyError: processedHistoryOpeningError,
      serverPending: processedOpeningStockServerPending,
      serverError: processedOpeningStockServerError,
      serverSuccess: processedOpeningStockServerSuccess,
      serverAuthoritative: serverOpeningAuthoritative,
      displayFromClient: dataSourceIsClient,
    });
    console.groupEnd();

    if (processedHistoryOpeningPending || processedHistoryOpeningError) {
      console.log("[processed-opening-stock] skip history row dump (still loading or error)");
    } else {
      console.groupCollapsed("[processed-opening-stock] raw history (" + hist.length + " rows)");
      console.table(
        hist.map((h) => ({
          productId: h.productId,
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
          "[processed-opening-stock] API returned rows but none fall on a local calendar day in the selected range."
        );
      }
      console.groupEnd();
    }

    console.groupCollapsed(
      "[processed-opening-stock] merged openingStockByDate (" +
        mergedOpeningStockData.openingStockByDate.length +
        " days)"
    );
    console.table(
      mergedOpeningStockData.openingStockByDate.map((d) => ({
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
    historyRowsForOpening,
    processedHistoryOpeningPending,
    processedHistoryOpeningError,
    processedOpeningStockServerPending,
    processedOpeningStockServerError,
    processedOpeningStockServerSuccess,
    serverOpeningAuthoritative,
    dataSourceIsClient,
    filteredProducts.length,
    effectiveSelectedOutletId,
    searchQuery,
    mergedOpeningStockData,
  ]);

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
    deductMutation.isPending ||
    deleteMutation.isPending;

  const handleEditSave = (values: CreateProductFormValues) => {
    if (productToEdit) {
      updateMutation.mutate({ id: productToEdit.id, values });
    }
  };

  const handleSubmitDeduct = () => {
    if (!deductTarget) return;
    const w = Number(deductWeight);
    if (!Number.isFinite(w) || w <= 0) return;
    const cap = getProcessedStockWeight(deductTarget);
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
          {!isScoped ? (
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
          ) : null}
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

      <div
        className="liveProductTabs"
        role="tablist"
        aria-label={t("Processed Products views")}
      >
        <button
          type="button"
          id="processed-product-tab-inventory"
          role="tab"
          aria-selected={mainTab === "inventory"}
          aria-controls="processed-product-panel-inventory"
          tabIndex={mainTab === "inventory" ? 0 : -1}
          className={`liveProductTab${mainTab === "inventory" ? " liveProductTabActive" : ""}`}
          onClick={() => setMainTab("inventory")}
        >
          {t("Inventory")}
        </button>
        <button
          type="button"
          id="processed-product-tab-opening"
          role="tab"
          aria-selected={mainTab === "openingClosing"}
          aria-controls="processed-product-panel-opening"
          tabIndex={mainTab === "openingClosing" ? 0 : -1}
          className={`liveProductTab${mainTab === "openingClosing" ? " liveProductTabActive" : ""}`}
          onClick={() => setMainTab("openingClosing")}
        >
          {t("Opening & closing")}
        </button>
      </div>

      {mainTab === "inventory" && (
        <div
          id="processed-product-panel-inventory"
          role="tabpanel"
          aria-labelledby="processed-product-tab-inventory"
          className="liveProductTabPanel"
        >
      <div className="productsTable">
        <div className="productsRow productsRowHeader processedInventoryRowHeader">
          <span>{t("Name")}</span>
          <span>{t("Product Type")}</span>
          <span>{t("Outlet")}</span>
          <span>{t("Weight")}</span>
          {/* <span>{t("Waste Weight")}</span> */}
          <span>{t("Actions")}</span>
        </div>
        {productsLoading && (
          <div className="productsRow processedRowWithActions processedRowMessage">
            <span className="productsMessage">{t("Loading…")}</span>
          </div>
        )}
        {productsError && (
          <div className="productsRow processedRowWithActions processedRowMessage">
            <span className="productsMessage productsError">
              {productsErrorDetail instanceof Error
                ? productsErrorDetail.message
                : t("Failed to load products")}
            </span>
          </div>
        )}
        {!productsLoading && !productsError && !processedTypeId && productTypes.length > 0 && (
          <div className="productsRow processedRowWithActions processedRowMessage">
            <span className="productsMessage">{t('No product type named "Processed" found.')}</span>
          </div>
        )}
        {!productsLoading &&
          !productsError &&
          processedTypeId &&
          filteredProducts.length === 0 && (
            <div className="productsRow processedRowWithActions processedRowMessage">
              <span className="productsMessage">
                {searchQuery.trim()
                  ? `${t("No processed products match")} "${searchQuery.trim()}".`
                  : t("No processed products yet.")}
              </span>
            </div>
          )}
        {!productsLoading &&
          !productsError &&
          filteredProducts.length > 0 &&
          paginatedProducts.map((product) => {
            const rowKey = product.id;
            return (
              <div key={rowKey} className="productsRow processedRowWithActions processedRowData">
                <span data-label={t("Name")}>{product.name}</span>
                <span data-label={t("Product Type")}>
                  {getTypeName(product.productTypeId)}
                </span>
                <span data-label={t("Outlet")}>{getOutletName(product.outletId)}</span>
                <span data-label={t("Weight")}>{formatProcessedWeightDisplay(product)}</span>
                {/* <span data-label={t("Waste Weight")}>{formatProcessedWasteWeightDisplay(product)}</span> */}
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
                  {
                    pathname: `/dashboard/product/processedProduct/${encodeURIComponent(openRowMenu.product.id)}`,
                    search: location.search || "",
                  },
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
        </div>
      )}

      {mainTab === "openingClosing" && (
        <div
          id="processed-product-panel-opening"
          role="tabpanel"
          aria-labelledby="processed-product-tab-opening"
          className="liveProductTabPanel"
        >
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
        {!openingStockRangeInvalid && clientStockMode === "movementOnly" && (
          <div className="openingClosingStockBanner openingClosingStockBannerInfo" role="status">
            {t(
              "Past date range: only restock and deduct movements from history are shown. Set \"Date to\" to today for opening and closing balances. Sales and processing-based stock changes may be missing until the backend includes them in history or opening-stock."
            )}
          </div>
        )}
        {!openingStockRangeInvalid && (
          <div className="openingClosingStockGrid">
            <OpeningStockTable
              from={openingStockFrom}
              to={openingStockTo}
              openingStockData={mergedOpeningStockData}
              isPending={openingStockPending}
              isError={openingStockError}
              errorMessage={openingStockErrorMessage}
              footnote={
                dataSourceIsClient && clientStockMode === "reconciled"
                  ? t(
""                    )
                  : null
              }
            />
            <ClosingStockTable
              from={openingStockFrom}
              to={openingStockTo}
              openingStockData={mergedOpeningStockData}
              isPending={openingStockPending}
              isError={openingStockError}
              errorMessage={openingStockErrorMessage}
            />
          </div>
        )}
      </section>
        </div>
      )}

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
                  (deductTarget !== null && Number(deductWeight) > getProcessedStockWeight(deductTarget)) ||
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
              {t("Current stock")} ({t("Weight")}): {formatProcessedWeightDisplay(deductTarget)}
            </p>
            <label className="productActionModalLabel">
              {t("Weight (kg)")}
              <input
                type="number"
                min={0}
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
