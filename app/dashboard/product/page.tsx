"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { MdMoreHoriz } from "react-icons/md";
import { IoGridOutline, IoLayersOutline, IoSettingsOutline } from "react-icons/io5";
import { LuBeef, LuBoxes, LuTag } from "react-icons/lu";
import { useI18n } from "@/app/providers/I18nProvider";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useToast } from "@/app/providers/ToastProvider";
import Pagination from "../../components/Pagination/Pagination";
import ConfirmModal from "../../components/Modal/ConfirmModal";
import Modal from "../../components/Modal/Modal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import {
  createProduct as createProductApi,
  deleteProduct as deleteProductApi,
  getProducts,
  updateProduct as updateProductApi,
  type Product,
} from "@/handlers/product";
import { getDualPricings } from "@/handlers/dualPricing";
import { hasDualPricingForProductOutlet } from "@/lib/dualPricingLookup";
import { buildPathWithOutletScope } from "@/lib/outletScope";
import { getMainOutletId, getOutlets } from "@/handlers/outlet";
import { getProductTypes } from "@/handlers/productType";
import { type CreateProductFormValues } from "@/schema/product";
import "./product.scss";
import ProductEditModal from "./ProductEditModal";
import SetPricelistAfterCreateModal, {
  type PricelistOutletTarget,
} from "./SetPricelistAfterCreateModal";

const PRODUCTS_QUERY_KEY = ["products"];
const DUAL_PRICING_QUERY_KEY = ["dualPricing"];

export default function ProductPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { capabilities } = usePermissions();
  const { scopedOutletId, isScoped, rowFilterOutletId } = useRowFilterOutletId();
  const invTo = (path: string) => buildPathWithOutletScope(path, scopedOutletId, search);
  const { showToast } = useToast();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [addProductName, setAddProductName] = useState("");
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pricelistModalOpen, setPricelistModalOpen] = useState(false);
  const [pricelistTargets, setPricelistTargets] = useState<PricelistOutletTarget[]>([]);
  const menuButtonRef = useRef<HTMLDivElement>(null);

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

  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: async () => {
      const result = await getOutlets();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: dualPricings = [] } = useQuery({
    queryKey: DUAL_PRICING_QUERY_KEY,
    queryFn: async () => {
      const result = await getDualPricings();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  useEffect(() => {
    if (!isAddModalOpen) {
      setAddProductName("");
      setAddFormError(null);
    }
  }, [isAddModalOpen]);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target as Node)
      ) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const closeEditModal = () => setSelectedProductId(null);

  const getProductTypeName = (p: Product) =>
    (typeof p.productType === "object" && p.productType?.name) ||
    productTypes.find((pt) => pt.id === p.productTypeId)?.name ||
    p.productTypeId;
  const getOutletName = (p: Product) =>
    (typeof p.outlet === "object" && p.outlet?.name) ||
    outlets.find((o) => o.id === p.outletId)?.name ||
    p.outletId;
  const isProcessedTypeId = (productTypeId: string) =>
    productTypes.some(
      (pt) => pt.id === productTypeId && pt.name.toLowerCase() === "processed"
    );
  const processedProductType = productTypes.find(
    (pt) => pt.name.toLowerCase() === "processed"
  );
  const processedProductTypeId = processedProductType?.id ?? "";

  const mainOutletId = useMemo(() => getMainOutletId(outlets), [outlets]);

  /** Sub-outlet scope: restrict list to that outlet; main or unscoped: all outlets. */
  const subOutletRowFilterId = useMemo(() => {
    if (!isScoped || !rowFilterOutletId) return null;
    if (mainOutletId && rowFilterOutletId === mainOutletId) return null;
    return rowFilterOutletId;
  }, [isScoped, rowFilterOutletId, mainOutletId]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (subOutletRowFilterId) {
      list = list.filter((p) => p.outletId === subOutletRowFilterId);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, searchQuery, subOutletRowFilterId]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(filteredProducts.length, { defaultPageSize: 10 });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, subOutletRowFilterId, setCurrentPage]);

  const paginatedProducts = useMemo(
    () => paginate(filteredProducts, startIndex, endIndex),
    [filteredProducts, startIndex, endIndex]
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProductApi(id),
    onSuccess: (result) => {
      if (result.ok) {
        setProductToDelete(null);
        queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      } else {
        if (result.status === 401) navigate("/login");
      }
    },
  });

  const handleConfirmDelete = () => {
    if (productToDelete) deleteMutation.mutate(productToDelete.id);
  };

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: CreateProductFormValues;
    }) => updateProductApi(id, values, { isProcessed: isProcessedTypeId(values.productTypeId) }),
    onSuccess: (result, variables) => {
      if (result.ok) {
        setSelectedProductId(null);
        const isProcessed = isProcessedTypeId(variables.values.productTypeId);
        queryClient.setQueryData<Product[]>(PRODUCTS_QUERY_KEY, (old) => {
          if (!old) return old;
          return old.map((p) =>
            p.id === variables.id
              ? {
                  ...p,
                  name: variables.values.name,
                  productTypeId: variables.values.productTypeId,
                  outletId: variables.values.outletId,
                  quantity: isProcessed ? p.quantity : variables.values.quantity,
                  weight: isProcessed ? variables.values.quantity : p.weight,
                  status: variables.values.status === "Active",
                }
              : p
          );
        });
      } else {
        if (result.status === 401) navigate("/login");
      }
    },
  });

  const onEditSave = (values: CreateProductFormValues) => {
    if (selectedProduct) {
      updateMutation.mutate({ id: selectedProduct.id, values });
    }
  };

  const createMutation = useMutation({
    mutationFn: async (productName: string) => {
      const trimmedName = productName.trim();
      const normalizedName = trimmedName.toLowerCase();
      if (!trimmedName) {
        return { ok: false as const, error: t("Product name is required"), status: 400 };
      }
      if (!processedProductTypeId) {
        return { ok: false as const, error: t('No product type named "Processed" found.'), status: 400 };
      }
      if (outlets.length === 0) {
        return { ok: false as const, error: t("No outlets found."), status: 400 };
      }

      const processedProductOutletIds = new Set(
        products
          .filter((product) => {
            const productName = product.name?.trim().toLowerCase() ?? "";
            const isProcessed =
              product.productTypeId === processedProductTypeId ||
              (typeof product.productType === "object" &&
                product.productType?.name?.toLowerCase() === "processed");
            return isProcessed && productName === normalizedName;
          })
          .map((product) => product.outletId)
      );

      const firstOutletWithoutProduct = outlets.find(
        (outlet) => !processedProductOutletIds.has(outlet.id)
      );

      if (!firstOutletWithoutProduct) {
        return {
          ok: false as const,
          error: t("This processed product already exists in all outlets."),
          status: 409,
        };
      }

      // One POST only: the API creates this processed product across outlets in a single request.
      // Looping per outlet duplicates rows when each POST also fan-outs to every outlet.
      const result = await createProductApi(
        {
          name: trimmedName,
          productTypeId: processedProductTypeId,
          outletId: firstOutletWithoutProduct.id,
          quantity: 0,
          status: "Active",
          createdBy: "",
        },
        { isProcessed: true }
      );
      if (!result.ok) return result;

      return { ok: true as const };
    },
    onSuccess: async (result, createdName: string) => {
      if (result.ok) {
        setIsAddModalOpen(false);
        setAddProductName("");
        setAddFormError(null);
        await queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
        let fresh: Product[] = [];
        try {
          fresh = await queryClient.fetchQuery({
            queryKey: PRODUCTS_QUERY_KEY,
            queryFn: async () => {
              const r = await getProducts();
              if (!r.ok) {
                if (r.status === 401) navigate("/login");
                throw new Error(r.error);
              }
              return r.data;
            },
          });
        } catch {
          showToast(t("Something went wrong. Please try again."), "error");
          return;
        }
        const normalized = createdName.trim().toLowerCase();
        const typeId = processedProductTypeId;
        const targets: PricelistOutletTarget[] = fresh
          .filter((p) => {
            const n = p.name?.trim().toLowerCase() ?? "";
            const isProc =
              (typeId !== "" && p.productTypeId === typeId) ||
              (typeof p.productType === "object" &&
                p.productType?.name?.toLowerCase() === "processed");
            return isProc && n === normalized;
          })
          .map((p) => ({
            productId: p.id,
            outletId: p.outletId,
            productName: p.name,
            outletName:
              (typeof p.outlet === "object" && p.outlet?.name) ||
              outlets.find((o) => o.id === p.outletId)?.name ||
              p.outletId,
          }));
        if (targets.length > 0 && capabilities.canEditDualPricing) {
          setPricelistTargets(targets);
          setPricelistModalOpen(true);
        } else if (targets.length > 0 && !capabilities.canEditDualPricing) {
          showToast(
            t(
              "Product created. Ask an admin to add Pricelist entries for this product before selling."
            ),
            "info"
          );
        }
      } else {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        setAddFormError(result.error);
      }
    },
    onError: () => {
      setAddFormError(t("Something went wrong. Please try again."));
    },
  });

  const onAddSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!addProductName.trim()) {
      setAddFormError(t("Product name is required"));
      return;
    }
    setAddFormError(null);
    createMutation.mutate(addProductName);
  };

  const loading = createMutation.isPending;
  return (
    <section className="productPage">
      <div className="breadcrumb">
        <span>{t("Product")}</span> {"›"} {t("Products")}
      </div>

      <div className="inventoryMobileHub" aria-label={t("Quick links")}>
        {capabilities.canViewInventory ? (
          <Link to={invTo("/dashboard/product/liveProduct")} className="inventoryMobileHub__chip">
            <LuBeef size={18} aria-hidden />
            <span>{t("Live Stock Inventory")}</span>
          </Link>
        ) : null}
        {capabilities.canViewInventory ? (
          <Link to={invTo("/dashboard/product/processedProduct")} className="inventoryMobileHub__chip">
            <LuBoxes size={18} aria-hidden />
            <span>{t("Processed Inventory")}</span>
          </Link>
        ) : null}
        {capabilities.canCreateProducts || capabilities.canViewDualPricing ? (
          <>
            {capabilities.canCreateProducts && (
              <>
                <Link to={invTo("/dashboard/product/livestockCategory")} className="inventoryMobileHub__chip">
                  <IoLayersOutline size={18} aria-hidden />
                  <span>{t("Livestock Category")}</span>
                </Link>
                <Link to={invTo("/dashboard/product/productType")} className="inventoryMobileHub__chip">
                  <IoGridOutline size={18} aria-hidden />
                  <span>{t("Product Type")}</span>
                </Link>
              </>
            )}
            {capabilities.canViewDualPricing && (
              <Link to={invTo("/dashboard/dualPricing")} className="inventoryMobileHub__chip">
                <LuTag size={18} aria-hidden />
                <span>{t("Pricelist")}</span>
              </Link>
            )}
          </>
        ) : null}
      </div>

      <div className="productHeader">
        <div className="productHeaderText">
          <h1 className="pageTitle">{t("Inventory")}</h1>
          <p className="pageSubtitle">
            {t("Create and manage products by type and outlet")}
          </p>
        </div>
        <div className="productHeaderActions">
          <Link
            to={buildPathWithOutletScope("/dashboard/more", scopedOutletId, search)}
            className="productHeaderSettings"
            aria-label={t("Settings")}
          >
            <IoSettingsOutline size={22} aria-hidden />
          </Link>
          <div className="productSearch">
            <span className="searchIcon" aria-hidden>
              🔍
            </span>
            <input
              className="searchInput"
              placeholder={t("Search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t("Search products")}
            />
          </div>
          {capabilities.canCreateProducts && (
          <button
            type="button"
            className="button buttonPrimary productHeaderAddBtn"
            onClick={() => setIsAddModalOpen(true)}
          >
            {t("Add Product")}
          </button>
          )}
        </div>
      </div>

      <div className="cardList">
        {productsLoading && (
          <div className="productPageState productPageStateMessage" role="status">
            <p className="productPageMessage">{t("Loading products…")}</p>
          </div>
        )}
        {productsError && (
          <div className="productPageState productPageStateMessage" role="alert">
            <p className="productPageMessage productPageError">
              {productsErrorDetail instanceof Error
                ? productsErrorDetail.message
                : t("Failed to load products")}
            </p>
          </div>
        )}
        {!productsLoading && !productsError && products.length === 0 && (
          <div className="productPageState productPageStateMessage">
            <p className="productPageMessage">
              {t("No products yet. Add one to get started.")}
            </p>
          </div>
        )}
        {!productsLoading &&
          !productsError &&
          products.length > 0 &&
          filteredProducts.length === 0 && (
            <div className="productPageState productPageStateMessage">
              <p className="productPageMessage">
                {t("No products match")} &quot;{searchQuery.trim()}&quot;.
              </p>
            </div>
          )}
        {!productsLoading &&
          !productsError &&
          filteredProducts.length > 0 &&
          paginatedProducts.map((product: Product) => (
            <article key={product.id} className="card">
              <div className="cardTop">
                <div className="cardTitleBlock">
                  <div className="cardTitleRow">
                    <h2 className="cardTitle">{product.name}</h2>
                    {isProcessedTypeId(product.productTypeId) &&
                      !hasDualPricingForProductOutlet(
                        dualPricings,
                        product.id,
                        product.outletId
                      ) && (
                      <></>
                      )}
                  </div>
                </div>
                {(capabilities.canEditProducts || capabilities.canDeleteProducts) && (
                <div className="cardTopActions">
                  <div
                    className="cardMenuWrap"
                    ref={openMenuId === product.id ? menuButtonRef : undefined}
                  >
                    <button
                      type="button"
                      className="cardMenuTrigger"
                      onClick={() =>
                        setOpenMenuId((id) =>
                          id === product.id ? null : product.id
                        )
                      }
                      aria-label={t("More options")}
                      aria-expanded={openMenuId === product.id}
                    >
                      <MdMoreHoriz aria-hidden size={22} />
                    </button>
                    {openMenuId === product.id && (
                      <div className="cardMenuDropdown">
                        {capabilities.canEditProducts && (
                        <button
                          type="button"
                          className="cardMenuItem cardMenuItemEditMobile"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedProductId(product.id);
                            setOpenMenuId(null);
                          }}
                        >
                          {t("Edit")}
                        </button>
                        )}
                        {capabilities.canDeleteProducts && (
                        <button
                          type="button"
                          className="cardMenuItem cardMenuItemDanger"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setProductToDelete(product);
                            setOpenMenuId(null);
                          }}
                        >
                          {t("Delete")}
                        </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                )}
              </div>

              <div className="productCardBody">
                <dl className="productCardMeta">
                  <div className="productCardMetaRow">
                    <dt>{t("Product Type")}</dt>
                    <dd>{getProductTypeName(product)}</dd>
                  </div>
                  <div className="productCardMetaRow">
                    <dt>{t("Outlet")}</dt>
                    <dd>{getOutletName(product)}</dd>
                  </div>
                </dl>
                {capabilities.canEditProducts && (
                <div className="cardEditSlot">
                  <button
                    type="button"
                    className="button buttonPrimary cardEditBtn"
                    onClick={() => setSelectedProductId(product.id)}
                  >
                    {t("Edit")}
                  </button>
                </div>
                )}
              </div>
            </article>
          ))}
      </div>

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

      {selectedProduct && capabilities.canEditProducts && (
        <ProductEditModal
          isOpen={Boolean(selectedProductId)}
          product={selectedProduct}
          productTypes={productTypes}
          outlets={outlets}
          onClose={closeEditModal}
          onSave={onEditSave}
          loading={updateMutation.isPending}
        />
      )}

      <ConfirmModal
        isOpen={!!productToDelete && capabilities.canDeleteProducts}
        title={t("Delete product")}
        message={
          productToDelete
            ? `${t("Are you sure you want to delete")} "${productToDelete.name}"? ${t(
                "This action cannot be undone."
              )}`
            : ""
        }
        confirmLabel={t("Delete")}
        cancelLabel={t("Cancel")}
        variant="danger"
        loading={deleteMutation.isPending}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      <SetPricelistAfterCreateModal
        isOpen={pricelistModalOpen}
        targets={pricelistTargets}
        onClose={() => {
          setPricelistModalOpen(false);
          setPricelistTargets([]);
        }}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: DUAL_PRICING_QUERY_KEY });
          void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
          showToast(t("Pricelist saved for the new product outlets."), "success");
        }}
      />

      <Modal
        isOpen={isAddModalOpen && capabilities.canCreateProducts}
        title={t("Add Product")}
        subtitle={t("Create a processed product. Stock is managed from processing flow.")}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddProductName("");
          setAddFormError(null);
        }}
        footer={
          <>
            <button
              type="button"
              className="button modalButton"
              onClick={() => {
                setIsAddModalOpen(false);
                setAddProductName("");
                setAddFormError(null);
              }}
            >
              {t("Discard")}
            </button>
            <button
              type="submit"
              form="add-product-form"
              className="button buttonPrimary modalButton"
              disabled={loading}
            >
              {loading ? t("Saving…") : t("Save")}
            </button>
          </>
        }
      >
        <form
          id="add-product-form"
          onSubmit={onAddSubmit}
          className="productAddForm"
        >
          {addFormError && (
            <p className="productFormError">{addFormError}</p>
          )}
          <label className="modalField">
            <span className="label">{t("Product name")}</span>
            <input
              className="input"
              placeholder={t("e.g. Pork")}
              value={addProductName}
              onChange={(e) => setAddProductName(e.target.value)}
            />
          </label>
          <label className="modalField">
            <span className="label">{t("Product Type")}</span>
            <input
              className="input"
              value={processedProductType?.name ?? t("Processed")}
              readOnly
            />
          </label>
        </form>
      </Modal>
    </section>
  );
}
