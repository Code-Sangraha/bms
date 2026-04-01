"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/app/providers/I18nProvider";
import Pagination from "../../components/Pagination/Pagination";
import ConfirmModal from "../../components/Modal/ConfirmModal";
import Modal from "../../components/Modal/Modal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import {
  createProduct as createProductApi,
  deleteProduct as deleteProductApi,
  getProducts,
  updateProduct as updateProductApi,
  type Product,
} from "@/handlers/product";
import { getOutlets } from "@/handlers/outlet";
import { getProductTypes } from "@/handlers/productType";
import { type CreateProductFormValues } from "@/schema/product";
import "./product.scss";
import ProductEditModal from "./ProductEditModal";

const PRODUCTS_QUERY_KEY = ["products"];

export default function ProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [addProductName, setAddProductName] = useState("");
  const [addFormError, setAddFormError] = useState<string | null>(null);
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

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(products.length, { defaultPageSize: 10 });
  const paginatedProducts = paginate(products, startIndex, endIndex);

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

      let createdCount = 0;
      for (const outlet of outlets) {
        if (processedProductOutletIds.has(outlet.id)) continue;
        const result = await createProductApi(
          {
            name: trimmedName,
            productTypeId: processedProductTypeId,
            outletId: outlet.id,
            quantity: 0,
            status: "Active",
            createdBy: "",
          },
          { isProcessed: true }
        );
        if (!result.ok) return result;
        createdCount += 1;
      }

      if (createdCount === 0) {
        return {
          ok: false as const,
          error: t("This processed product already exists in all outlets."),
          status: 409,
        };
      }

      return { ok: true as const };
    },
    onSuccess: (result) => {
      if (result.ok) {
        setIsAddModalOpen(false);
        setAddProductName("");
        setAddFormError(null);
        queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
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

      <div className="productHeader">
        <div className="productHeaderText">
          <h1 className="pageTitle">{t("Products")}</h1>
          <p className="pageSubtitle">
            {t("Create and manage products by type and outlet")}
          </p>
        </div>
        <button
          type="button"
          className="button buttonPrimary"
          onClick={() => setIsAddModalOpen(true)}
        >
          {t("Add Product")}
        </button>
      </div>

      <div className="cardList">
        {productsLoading && (
          <p className="productPageMessage">{t("Loading products…")}</p>
        )}
        {productsError && (
          <p className="productPageMessage productPageError">
            {productsErrorDetail instanceof Error
              ? productsErrorDetail.message
              : t("Failed to load products")}
          </p>
        )}
        {!productsLoading && !productsError && products.length === 0 && (
          <p className="productPageMessage">
            {t("No products yet. Add one to get started.")}
          </p>
        )}
        {!productsLoading &&
          !productsError &&
          paginatedProducts.map((product: Product) => (
            <article key={product.id} className="card">
              <div className="cardTop">
                <div className="cardTitleBlock">
                  <h2 className="cardTitle">{product.name}</h2>
                  <span className="cardId">{product.id}</span>
                </div>
                <div className="badgeGroup">
                  <span
                    className={
                      product.status ? "badge badgeActive" : "badge"
                    }
                  >
                    {product.status ? t("Active") : t("Inactive")}
                  </span>
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
                      ⋮
                    </button>
                    {openMenuId === product.id && (
                      <div className="cardMenuDropdown">
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
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="cardBody">
                <label className="field">
                  <span className="label">{t("Product Type")}</span>
                  <input
                    className="input"
                    value={getProductTypeName(product)}
                    readOnly
                  />
                </label>
                <label className="field">
                  <span className="label">{t("Outlet")}</span>
                  <input
                    className="input"
                    value={getOutletName(product)}
                    readOnly
                  />
                </label>
              </div>

              <div className="cardActions">
                <button
                  type="button"
                  className="button buttonPrimary"
                  onClick={() => setSelectedProductId(product.id)}
                >
                  {t("Edit")}
                </button>
              </div>
            </article>
          ))}
      </div>

      {!productsLoading && !productsError && products.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={products.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          pageSizeOptions={[10, 20, 50]}
          onPageSizeChange={setPageSize}
        />
      )}

      {selectedProduct && (
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
        isOpen={!!productToDelete}
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

      <Modal
        isOpen={isAddModalOpen}
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
