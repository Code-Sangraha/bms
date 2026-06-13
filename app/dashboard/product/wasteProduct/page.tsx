"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Modal from "@/app/components/Modal/Modal";
import Pagination from "@/app/components/Pagination/Pagination";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import {
  createWasteProduct,
  getWasteProducts,
  WASTE_PRODUCTS_QUERY_KEY,
  type WasteProduct,
} from "@/handlers/product";
import { getOutlets } from "@/handlers/outlet";
import { getProcessedStockWeight } from "@/app/dashboard/product/processedProduct/lib/processedStockWeight";
import {
  refreshWasteProductsAfterCreate,
  wasteProductNameExists,
} from "./lib/wasteProductCreate";
import { logWasteProductsDebug } from "@/lib/wasteProductsDebug";
import "../processedProduct/processedProduct.scss";
import "./wasteProduct.scss";

const PRODUCTS_QUERY_KEY = ["products"];

const createWasteProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long"),
});

type CreateWasteProductFormValues = z.infer<typeof createWasteProductSchema>;

function formatWasteWeight(product: WasteProduct): string {
  const w = getProcessedStockWeight(product);
  return Number.isFinite(w) ? String(w) : "—";
}

export default function WasteProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { showToast } = useToast();
  const { capabilities } = usePermissions();
  const { isScoped, rowFilterOutletId } = useRowFilterOutletId();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const {
    data: wasteProducts = [],
    isLoading,
    isError,
    error: errorDetail,
  } = useQuery({
    queryKey: WASTE_PRODUCTS_QUERY_KEY,
    queryFn: async () => {
      logWasteProductsDebug("WasteProductPage: queryFn start");
      const result = await getWasteProducts();
      if (!result.ok) {
        logWasteProductsDebug("WasteProductPage: queryFn failed", {
          status: result.status,
          error: result.error,
        });
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      logWasteProductsDebug("WasteProductPage: queryFn success", {
        count: result.data.length,
        products: result.data,
      });
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

  const filteredProducts = useMemo(() => {
    let list = wasteProducts;
    if (isScoped && rowFilterOutletId) {
      list = list.filter((p) => p.outletId === rowFilterOutletId);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    const outletNames = new Map(outlets.map((o) => [o.id, o.name.toLowerCase()]));
    return list.filter((p) => {
      const name = p.name.toLowerCase();
      const outletName = outletNames.get(p.outletId) ?? "";
      return name.includes(q) || outletName.includes(q);
    });
  }, [wasteProducts, isScoped, rowFilterOutletId, searchQuery, outlets]);

  useEffect(() => {
    logWasteProductsDebug("WasteProductPage: list state", {
      isScoped,
      rowFilterOutletId,
      wasteProductsCount: wasteProducts.length,
      filteredProductsCount: filteredProducts.length,
      isLoading,
      isError,
      errorDetail: errorDetail instanceof Error ? errorDetail.message : errorDetail,
    });
  }, [
    isScoped,
    rowFilterOutletId,
    wasteProducts,
    filteredProducts.length,
    isLoading,
    isError,
    errorDetail,
  ]);

  const getOutletName = (outletId: string) =>
    outlets.find((o) => o.id === outletId)?.name ?? outletId;

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

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateWasteProductFormValues>({
    resolver: zodResolver(createWasteProductSchema),
    defaultValues: { name: "" },
  });

  const watchedName = watch("name");

  const duplicateOutletId = isScoped && rowFilterOutletId ? rowFilterOutletId : null;

  const isDuplicateName = useMemo(() => {
    if (!watchedName?.trim()) return false;
    return wasteProductNameExists(wasteProducts, watchedName, duplicateOutletId);
  }, [watchedName, wasteProducts, duplicateOutletId]);

  useEffect(() => {
    if (!isCreateOpen) reset({ name: "" });
  }, [isCreateOpen, reset]);

  const createMutation = useMutation({
    mutationFn: async (values: CreateWasteProductFormValues) => {
      const name = values.name.trim();
      logWasteProductsDebug("WasteProductPage: create mutation start", {
        name,
        duplicateOutletId,
        existingCount: wasteProducts.length,
      });
      if (wasteProductNameExists(wasteProducts, name, duplicateOutletId)) {
        return {
          ok: false as const,
          error: t("A waste product with this name already exists for this outlet."),
          status: 400,
        };
      }

      const createResult = await createWasteProduct({ name });
      if (!createResult.ok) return createResult;

      const refresh = await refreshWasteProductsAfterCreate(name);
      logWasteProductsDebug("WasteProductPage: create mutation done", {
        name,
        synced: refresh.found,
        listCount: refresh.products.length,
      });
      return {
        ok: true as const,
        data: createResult.data,
        synced: refresh.found,
        products: refresh.products,
      };
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        showToast(result.error ?? t("Failed to create waste product."), "error");
        return;
      }

      if (result.products.length > 0) {
        queryClient.setQueryData(WASTE_PRODUCTS_QUERY_KEY, result.products);
      } else {
        void queryClient.invalidateQueries({
          queryKey: WASTE_PRODUCTS_QUERY_KEY,
          refetchType: "active",
        });
      }
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      setIsCreateOpen(false);

      if (result.synced) {
        showToast(t("Waste product created."), "success");
      } else {
        showToast(
          t("Waste product is being created across outlets. Refresh if it does not appear shortly."),
          "success"
        );
      }
    },
    onError: () => {
      showToast(t("Something went wrong. Please try again."), "error");
    },
  });

  const onCreateSubmit = (values: CreateWasteProductFormValues) => {
    const name = values.name.trim();
    if (wasteProductNameExists(wasteProducts, name, duplicateOutletId)) {
      setError("name", {
        type: "manual",
        message: t("A waste product with this name already exists for this outlet."),
      });
      return;
    }
    createMutation.mutate({ ...values, name });
  };

  const canCreate = capabilities.canInputWasteProducts;
  const isCreatePending = createMutation.isPending;
  const trimmedWatchedName = watchedName?.trim() ?? "";
  const canSubmitCreate =
    trimmedWatchedName.length > 0 && !isDuplicateName && !isCreatePending;

  return (
    <section className="processedProductPage wasteProductPage">
      <div className="processedProductBreadcrumb">
        <span className="processedProductBreadcrumbMuted">{t("Dashboard")}</span>
        <span className="processedProductBreadcrumbSep" aria-hidden> / </span>
        <span className="processedProductBreadcrumbCurrent">{t("Waste Products")}</span>
      </div>

      <header className="processedProductHeader">
        <div>
          <h1 className="processedProductTitle">{t("Waste Products")}</h1>
          <p className="processedProductSubtitle">
            {t("Waste stock increases when you deduct processed products or complete processing.")}
          </p>
        </div>
        <div className="processedProductHeaderActions">
          {canCreate && (
            <button
              type="button"
              className="processedProductAddBtn"
              onClick={() => setIsCreateOpen(true)}
            >
              {t("Create waste product")}
            </button>
          )}
          <div className="processedProductSearch">
            <span className="searchIcon" aria-hidden>🔍</span>
            <input
              className="searchInput"
              placeholder={t("Search")}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              aria-label={t("Search waste products")}
            />
          </div>
        </div>
      </header>

      <div className="productsTable">
        <div className="productsRow productsRowHeader processedInventoryRowHeader wasteProductRowHeader">
          <span>{t("Name")}</span>
          <span>{t("Outlet")}</span>
          <span>{t("Weight")}</span>
        </div>
        {isLoading && (
          <div className="productsRow processedRowMessage">
            <span className="productsMessage">{t("Loading…")}</span>
          </div>
        )}
        {isError && (
          <div className="productsRow processedRowMessage">
            <span className="productsMessage productsError">
              {errorDetail instanceof Error ? errorDetail.message : t("Failed to load waste products.")}
            </span>
          </div>
        )}
        {!isLoading && !isError && filteredProducts.length === 0 && (
          <div className="productsRow processedRowMessage wasteProductEmpty">
            <span className="productsMessage">
              {searchQuery.trim()
                ? `${t("No waste products match")} "${searchQuery.trim()}".`
                : t("No waste products yet.")}
            </span>
            {canCreate && !searchQuery.trim() && (
              <p className="wasteProductEmptyHint">
                {t("Create a waste product to route deducted or processing waste into inventory.")}
              </p>
            )}
          </div>
        )}
        {!isLoading &&
          !isError &&
          paginatedProducts.map((product) => (
            <div key={product.id} className="productsRow wasteProductRow">
              <span data-label={t("Name")}>{product.name}</span>
              <span data-label={t("Outlet")}>{getOutletName(product.outletId)}</span>
              <span data-label={t("Weight")}>{formatWasteWeight(product)}</span>
            </div>
          ))}
      </div>

      {filteredProducts.length > 0 && (
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

      <Modal
        isOpen={isCreateOpen}
        onClose={() => !isCreatePending && setIsCreateOpen(false)}
        title={t("Create waste product")}
        subtitle={t("Creates this waste SKU for every outlet.")}
        modalClassName="modalWide"
      >
        <form onSubmit={handleSubmit(onCreateSubmit)} className="livestockDetailModalForm space-y-3">
          <p className="livestockDetailModalHint" role="note">
            {t("The same name is created in every outlet. Names are compared without extra spaces.")}
          </p>
          <div className="livestockDetailModalField">
            <label className="livestockDetailModalLabel" htmlFor="waste-product-name">
              {t("Name")}
            </label>
            <input
              id="waste-product-name"
              type="text"
              className="livestockDetailModalInput"
              disabled={isSubmitting || isCreatePending}
              {...register("name")}
            />
            {errors.name?.message && (
              <p className="livestockDetailModalError" role="alert">{errors.name.message}</p>
            )}
            {isDuplicateName && !errors.name?.message && (
              <p className="livestockDetailModalError" role="alert">
                {t("A waste product with this name already exists for this outlet.")}
              </p>
            )}
          </div>
          <div className="livestockDetailModalFooter">
            <button
              type="button"
              className="livestockDetailModalBtn"
              onClick={() => setIsCreateOpen(false)}
              disabled={isCreatePending}
            >
              {t("Cancel")}
            </button>
            <button
              type="submit"
              className="livestockDetailModalBtn livestockDetailModalBtnPrimary"
              disabled={!canSubmitCreate}
            >
              {isCreatePending ? t("Creating across outlets…") : t("Create")}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
