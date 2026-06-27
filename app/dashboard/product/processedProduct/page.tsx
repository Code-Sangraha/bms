"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useI18n } from "@/app/providers/I18nProvider";
import { usePermissions } from "@/app/providers/AuthProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import { PageHeader } from "@/app/components/ui-ext/PageHeader";
import { DataTable, type DataTableColumn } from "@/app/components/ui-ext/DataTable";
import ConfirmDialog from "@/app/components/ui-ext/ConfirmDialog";
import ProcessedActionDialog from "./ProcessedActionDialog";
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
import { MoreHorizontal } from "lucide-react";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import {
  deleteProduct as deleteProductApi,
  deductProduct,
  getProcessedInventoryHistory,
  getProcessedOpeningStock,
  getProducts,
  updateProduct as updateProductApi,
  WASTE_PRODUCTS_QUERY_KEY,
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
import { getMainOutletId, getOutlets } from "@/handlers/outlet";
import { getProductTypes } from "@/handlers/productType";
import { type CreateProductFormValues } from "@/schema/product";
import {
  filterProcessedNonWasteProducts,
  getProcessedTypeIds,
  getWasteTypeIds,
  isWasteProduct,
} from "@/app/dashboard/product/lib/productTypeFilters";
import ProductEditModal from "../ProductEditModal";
import WasteProductSelect from "../wasteProduct/WasteProductSelect";
import "../liveProduct/openingClosingStock.scss";

const PRODUCT_TYPE_NAME = "Processed";
const PRODUCTS_QUERY_KEY = ["products"];

function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatProcessedWeightDisplay(product: Product): string {
  const w = product.weight;
  if (w != null && Number.isFinite(Number(w))) return String(w);
  const q = product.quantity;
  if (q != null && Number.isFinite(Number(q))) return String(q);
  return "—";
}

export default function ProcessedProductPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { capabilities } = usePermissions();
  const { isScoped, rowFilterOutletId } = useRowFilterOutletId();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOutletId, setSelectedOutletId] = useState("all");
  const [mainTab, setMainTab] = useState("inventory");

  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [deductTarget, setDeductTarget] = useState<Product | null>(null);
  const [deductWeight, setDeductWeight] = useState("");
  const [deductWasteProductId, setDeductWasteProductId] = useState("");
  const [deductError, setDeductError] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [openingStockFrom, setOpeningStockFrom] = useState(() => toIsoDateLocal(new Date()));
  const [openingStockTo, setOpeningStockTo] = useState(() => toIsoDateLocal(new Date()));
  const openingStockRangeInvalid = openingStockFrom > openingStockTo;

  const { data: products = [], isLoading: productsLoading, isError: productsError } = useQuery({
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

  const mainOutletId = useMemo(() => getMainOutletId(outlets), [outlets]);

  useEffect(() => {
    if (!isScoped || !rowFilterOutletId) return;
    if (mainOutletId && rowFilterOutletId === mainOutletId) {
      setSelectedOutletId("all");
      return;
    }
    setSelectedOutletId(rowFilterOutletId);
  }, [isScoped, rowFilterOutletId, mainOutletId]);

  const effectiveSelectedOutletId = useMemo(() => {
    if (isScoped && rowFilterOutletId) {
      if (mainOutletId && rowFilterOutletId === mainOutletId) return "all";
      return rowFilterOutletId;
    }
    return selectedOutletId;
  }, [isScoped, rowFilterOutletId, mainOutletId, selectedOutletId]);

  const processedTypeIds = useMemo(() => getProcessedTypeIds(productTypes), [productTypes]);
  const wasteTypeIds = useMemo(() => getWasteTypeIds(productTypes), [productTypes]);

  const processedTypeId = useMemo(
    () => productTypes.find((pt) => pt.name.toLowerCase() === PRODUCT_TYPE_NAME.toLowerCase())?.id ?? null,
    [productTypes]
  );

  const filteredProducts = useMemo(() => {
    let list: Product[] = filterProcessedNonWasteProducts(
      processedTypeId ? products.filter((p) => p.productTypeId === processedTypeId) : [],
      processedTypeIds,
      wasteTypeIds
    );
    list = list.filter((p) => !isWasteProduct(p, wasteTypeIds));
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
  }, [products, processedTypeId, processedTypeIds, wasteTypeIds, effectiveSelectedOutletId, searchQuery, outlets, productTypes]);

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
        setDeductWasteProductId("");
        invalidateProducts();
        void queryClient.invalidateQueries({ queryKey: WASTE_PRODUCTS_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: ["processedInventoryHistory"] });
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
    if (!deductWasteProductId.trim()) {
      setDeductError(t("Waste product is required when deducting weight."));
      return;
    }
    const cap = getProcessedStockWeight(deductTarget);
    if (w > cap) {
      setDeductError(t("Deduct amount cannot exceed current stock."));
      return;
    }
    setDeductError(null);
    deductMutation.mutate({
      id: deductTarget.id,
      outletId: deductTarget.outletId,
      weight: w,
      productId: deductWasteProductId.trim(),
    });
  };

  const handleConfirmDelete = () => {
    if (productToDelete) deleteMutation.mutate(productToDelete.id);
  };

  const columns: DataTableColumn<Product>[] = [
    {
      id: "name",
      header: t("Name"),
      cell: (product) => <span className="font-medium">{product.name}</span>,
    },
    {
      id: "type",
      header: t("Product Type"),
      cell: (product) => (
        <span className="text-muted-foreground">{getTypeName(product.productTypeId)}</span>
      ),
    },
    {
      id: "outlet",
      header: t("Outlet"),
      cell: (product) => (
        <span className="text-muted-foreground">{getOutletName(product.outletId)}</span>
      ),
    },
    {
      id: "weight",
      header: t("Weight"),
      align: "right",
      cell: (product) => (
        <span className="font-mono tabular-nums">{formatProcessedWeightDisplay(product)}</span>
      ),
    },
    {
      id: "actions",
      header: t("Actions"),
      align: "center",
      cell: (product) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("More options")}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {capabilities.canEditProducts && (
              <DropdownMenuItem
                disabled={rowMutationsPending}
                onClick={() => setProductToEdit(product)}
              >
                {t("Edit")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={rowMutationsPending}
              onClick={() =>
                navigate(
                  {
                    pathname: `/dashboard/product/processedProduct/${encodeURIComponent(product.id)}`,
                    search: location.search || "",
                  },
                  {
                    state: {
                      productSnapshot: product,
                    } satisfies ProcessedDetailLocationState,
                  }
                )
              }
            >
              {t("View")}
            </DropdownMenuItem>
            {capabilities.canDeductProcessedInventory && (
              <DropdownMenuItem
                disabled={rowMutationsPending}
                onClick={() => {
                  setDeductTarget(product);
                  setDeductWeight("");
                  setDeductWasteProductId("");
                  setDeductError(null);
                }}
              >
                {t("Deduct")}
              </DropdownMenuItem>
            )}
            {capabilities.canDeleteProducts && (
              <DropdownMenuItem
                disabled={rowMutationsPending}
                className="text-destructive focus:text-destructive"
                onClick={() => setProductToDelete(product)}
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
        title={t("Processed Products")}
        subtitle={t("Products of type Processed")}
        breadcrumb={
          <p className="text-sm text-muted-foreground">
            {t("Product")} › {t("Processed")}
          </p>
        }
        actions={
          <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto sm:flex-nowrap">
            {!isScoped ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="outlet-filter" className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("Outlet")}
                </Label>
                <Select
                  value={selectedOutletId}
                  onValueChange={(value) => {
                    setSelectedOutletId(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger id="outlet-filter" className="w-[180px]">
                    <SelectValue placeholder={t("All Outlets")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("All Outlets")}</SelectItem>
                    {outlets.map((outlet) => (
                      <SelectItem key={outlet.id} value={outlet.id}>
                        {outlet.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("Search")}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label={t("Search processed products")}
                className="w-full min-w-[150px] pl-9 sm:w-[220px]"
              />
            </div>
          </div>
        }
      />

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="inventory">{t("Inventory")}</TabsTrigger>
          <TabsTrigger value="openingClosing">{t("Opening & closing")}</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-4">
          <DataTable
            columns={columns}
            rows={paginatedProducts}
            isLoading={productsLoading}
            isError={productsError}
            emptyTitle={
              searchQuery.trim()
                ? `${t("No processed products match")} "${searchQuery.trim()}".`
                : t("No processed products yet.")
            }
            getRowKey={(product) => product.id}
            footer={
              filteredProducts.length > 0 ? (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredProducts.length}
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
          <section className="openingClosingStockSection" aria-labelledby="processed-opening-closing-heading">
            <h2 id="processed-opening-closing-heading" className="text-lg font-semibold">
              {t("Processed products opening and closing")}
            </h2>
            <div className="openingClosingStockDateRow">
              <div className="openingClosingStockDateField">
                <Label htmlFor="processed-opening-stock-from" className="openingClosingStockDateLabel">
                  {t("Date from")}
                </Label>
                <Input
                  id="processed-opening-stock-from"
                  type="date"
                  className="openingClosingStockDateInput"
                  value={openingStockFrom}
                  onChange={(e) => setOpeningStockFrom(e.target.value)}
                />
              </div>
              <div className="openingClosingStockDateField">
                <Label htmlFor="processed-opening-stock-to" className="openingClosingStockDateLabel">
                  {t("Date to")}
                </Label>
                <Input
                  id="processed-opening-stock-to"
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
                      ? t("")
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
        </TabsContent>
      </Tabs>

      {productToEdit && capabilities.canEditProducts && (
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

      <ProcessedActionDialog
        isOpen={!!deductTarget && capabilities.canDeductProcessedInventory}
        onClose={() => {
          setDeductTarget(null);
          setDeductWeight("");
          setDeductWasteProductId("");
          setDeductError(null);
        }}
        title={t("Deduct processed stock")}
        subtitle={deductTarget?.name ?? ""}
        loading={deductMutation.isPending}
        footer={
          deductTarget ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeductTarget(null);
                  setDeductWeight("");
                  setDeductWasteProductId("");
                  setDeductError(null);
                }}
              >
                {t("Cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleSubmitDeduct}
                disabled={
                  !deductWeight ||
                  !deductWasteProductId.trim() ||
                  !Number.isFinite(Number(deductWeight)) ||
                  Number(deductWeight) <= 0 ||
                  (deductTarget !== null && Number(deductWeight) > getProcessedStockWeight(deductTarget)) ||
                  deductMutation.isPending
                }
              >
                {deductMutation.isPending ? t("Saving…") : t("Deduct")}
              </Button>
            </>
          ) : null
        }
      >
        {deductTarget && (
          <>
            {deductError && <p className="text-sm text-destructive">{deductError}</p>}
            <p className="text-sm text-muted-foreground">
              {t("Current stock")} ({t("Weight")}): {formatProcessedWeightDisplay(deductTarget)}
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="deduct-weight">{t("Weight (kg)")}</Label>
              <Input
                id="deduct-weight"
                type="number"
                min={0}
                step="any"
                value={deductWeight}
                onChange={(e) => {
                  setDeductWeight(e.target.value);
                  setDeductError(null);
                }}
                placeholder={t("Enter weight")}
              />
            </div>
            <WasteProductSelect
              id="processed-list-deduct-waste-product"
              value={deductWasteProductId}
              onChange={(value) => {
                setDeductWasteProductId(value);
                setDeductError(null);
              }}
              disabled={deductMutation.isPending}
            />
          </>
        )}
      </ProcessedActionDialog>

      <ConfirmDialog
        isOpen={!!productToDelete && capabilities.canDeleteProducts}
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
    </div>
  );
}
