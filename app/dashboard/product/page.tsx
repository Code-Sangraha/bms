"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
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
import { createLivestockItem } from "@/handlers/livestock";
import { getOutlets } from "@/handlers/outlet";
import { getProductTypes } from "@/handlers/productType";
import { getProducts as getProductsList } from "@/handlers/product";
import {
  createProductSchema,
  type CreateProductFormValues,
} from "@/schema/product";
import "./product.scss";
import ProductEditModal from "./ProductEditModal";

const PRODUCTS_QUERY_KEY = ["products"];

// We initialise only the common fields here and let
// react-hook-form manage the rest so we don't fight
// the user's typing (especially for numeric fields).
const defaultAddFormValues = {
  productType: "processed" as const,
  name: "",
  productTypeId: "",
  outletId: "",
  quantity: 0,
  status: "Active" as const,
} as unknown as CreateProductFormValues;

export default function ProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<"processed" | "live">("processed");
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

  // Get all products for the product dropdown (for live tab)
  const { data: allProducts = [] } = useQuery({
    queryKey: ["allProducts"],
    queryFn: async () => {
      const result = await getProductsList();
      if (!result.ok) throw new Error(result.error);
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

  const {
    register,
    handleSubmit,
    setError,
    reset,
    setValue,
    getValues,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: defaultAddFormValues,
  });

  // Watch productTypeId for live tab to get selected product
  const selectedProductId_watch = watch("productTypeId");

  // Get processed product types
  const processedProductTypes = productTypes.filter((pt) => 
    pt.name.toLowerCase().includes("processed")
  );

  // Set default processed product type when modal opens
  useEffect(() => {
    if (isAddModalOpen && activeTab === "processed" && processedProductTypes.length > 0) {
      if (!getValues("productTypeId")) {
        setValue("productTypeId", processedProductTypes[0].id);
      }
    }
  }, [isAddModalOpen, activeTab, processedProductTypes, setValue, getValues]);

  useEffect(() => {
    if (!isAddModalOpen) {
      reset(defaultAddFormValues);
      setActiveTab("processed");
    }
  }, [isAddModalOpen, reset]);

  useEffect(() => {
    if (!isAddModalOpen) return;

    // Update the form's productType when tab changes
    setValue("productType", activeTab);

    if (activeTab === "processed") {
      // For processed products – keep whatever the user typed
      // for weight/price/itemId instead of forcing them to 0.
      // Set default outlet if available for processed products
      if (outlets.length > 0 && !getValues("outletId")) {
        setValue("outletId", outlets[0].id);
      }
      // Set default product type if available
      if (processedProductTypes.length > 0 && !getValues("productTypeId")) {
        setValue("productTypeId", processedProductTypes[0].id);
      }
      clearErrors(["weight", "price", "itemId"]);
    } else if (activeTab === "live") {
      // For live products - outletId is NOT needed
      setValue("quantity", 0);
      setValue("outletId", ""); // Clear outletId for live products
      clearErrors(["quantity", "outletId"]);
    }
  }, [activeTab, isAddModalOpen, setValue, clearErrors, outlets, getValues, processedProductTypes]);

  // When a product is selected in live tab, set the name
  useEffect(() => {
    if (activeTab === "live" && selectedProductId_watch) {
      const selectedProduct = allProducts.find(p => p.id === selectedProductId_watch);
      if (selectedProduct) {
        setValue("name", selectedProduct.name);
      }
    }
  }, [selectedProductId_watch, activeTab, allProducts, setValue]);

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
    }) => updateProductApi(id, values),
    onSuccess: (result, variables) => {
      if (result.ok) {
        setSelectedProductId(null);
        queryClient.setQueryData<Product[]>(PRODUCTS_QUERY_KEY, (old) => {
          if (!old) return old;
          return old.map((p) =>
            p.id === variables.id
              ? {
                  ...p,
                  name: variables.values.name,
                  productTypeId: variables.values.productTypeId,
                  outletId: variables.values.outletId,
                  quantity: variables.values.quantity,
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
    mutationFn: async (values: CreateProductFormValues) => {
      if (values.productType === "live") {
        // For live products - livestock item
        if (!values.itemId || !values.weight || !values.price) {
          throw new Error("Missing required fields for livestock item");
        }
        
        const payload = {
          productId: values.productTypeId, // This is the product category ID
          name: values.name,
          itemId: values.itemId,
          weight: Number(values.weight),
          price: Number(values.price),
          status: values.status === "Active",
        };
        
        console.log("Creating livestock item with payload:", payload);
        return createLivestockItem(payload);
      } else {
        // For processed products - using the curl example
        const payload = {
          name: values.name,
          productTypeId: values.productTypeId,
          outletId: values.outletId,
          weight: Number(values.weight), // API expects weight for processed products (based on your curl)
          status: values.status === "Active",
        };

        console.log("Creating processed product with payload:", payload);
        return createProductApi(payload);
      }
    },
    onSuccess: (result, variables) => {
      if (result.ok) {
        setIsAddModalOpen(false);
        queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: ["allProducts"] });

        // Redirect based on which tab/product type was used
        if (variables.productType === "live") {
          navigate("/dashboard/product/liveProduct");
        } else {
          navigate("/dashboard/product/processedProduct");
        }
      } else {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        setError("root", { message: result.error });
      }
    },
    onError: (error) => {
      setError("root", {
        message: error instanceof Error ? error.message : t("Something went wrong. Please try again."),
      });
    },
  });

  const onAddSubmit = (data: CreateProductFormValues) => {
    // Log the data being submitted for debugging
    console.log("Submitting form data:", data);
    createMutation.mutate(data);
  };

  const loading = isSubmitting || createMutation.isPending;

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
                <label className="field">
                  <span className="label">{t("Weight/Quantity")}</span>
                  <input
                    className="input"
                    type="text"
                    value={product.quantity || product.weight || 0}
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
        subtitle={activeTab === "live" ? t("Create a new livestock item") : t("Create a new product with type, outlet, and quantity")}
        onClose={() => setIsAddModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="button modalButton"
              onClick={() => setIsAddModalOpen(false)}
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
        <div className="productTabs">
          <button
            type="button"
            className={`productTab ${activeTab === "processed" ? "active" : ""}`}
            onClick={() => setActiveTab("processed")}
          >
            {t("Processed")}
          </button>
          <button
            type="button"
            className={`productTab ${activeTab === "live" ? "active" : ""}`}
            onClick={() => setActiveTab("live")}
          >
            {t("Live")}
          </button>
        </div>
        <form
          id="add-product-form"
          onSubmit={handleSubmit(onAddSubmit)}
          className="productAddForm"
        >
          {/* Hidden field for product type */}
          <input type="hidden" {...register("productType")} />

          {errors.root?.message && (
            <p className="productFormError">{errors.root.message}</p>
          )}

          {activeTab === "processed" ? (
            // Processed product fields
            <>
              <label className="modalField">
                <span className="label">{t("Product name")}</span>
                <input
                  className="input"
                  placeholder={t("e.g. Pork")}
                  {...register("name")}
                />
                {errors.name && (
                  <span className="productFieldError">{errors.name.message}</span>
                )}
              </label>

              <label className="modalField">
                <span className="label">{t("Product Type")}</span>
                <select 
                  className="select" 
                  {...register("productTypeId")}
                  value={watch("productTypeId") || (processedProductTypes.length > 0 ? processedProductTypes[0].id : "")}
                  onChange={(e) => setValue("productTypeId", e.target.value)}
                >
                  {processedProductTypes.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.name}
                    </option>
                  ))}
                </select>
                {errors.productTypeId && (
                  <span className="productFieldError">
                    {errors.productTypeId.message}
                  </span>
                )}
              </label>

              <label className="modalField">
                <span className="label">{t("Outlet")}</span>
                <select className="select" {...register("outletId")}>
                  <option value="">{t("Select outlet")}</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                {errors.outletId && (
                  <span className="productFieldError">
                    {errors.outletId.message}
                  </span>
                )}
              </label>

              <label className="modalField">
                <span className="label">{t("Weight")}</span>
                <input
                  className="input"
                  type="number"
                  step="any"
                  placeholder={t("e.g. 50")}
                  {...register("weight")}
                />
                {errors.weight && (
                  <span className="productFieldError">
                    {errors.weight.message}
                  </span>
                )}
              </label>
            </>
          ) : (
            // Livestock fields - EXACTLY matching Postman API structure
            <>
              <label className="modalField">
                <span className="label">{t("Livestock Product Category")}</span>
                <select 
                  className="select" 
                  {...register("productTypeId")}
                  onChange={(e) => {
                    const selectedProduct = allProducts.find(p => p.id === e.target.value);
                    if (selectedProduct) {
                      setValue("name", selectedProduct.name);
                    }
                  }}
                >
                  <option value="">{t("Select livestock category")}</option>
                  {allProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                {errors.productTypeId && (
                  <span className="productFieldError">
                    {errors.productTypeId.message}
                  </span>
                )}
              </label>

              {/* Hidden field for name - will be set automatically */}
              <input type="hidden" {...register("name")} />

              <label className="modalField">
                <span className="label">{t("Item ID")}</span>
                <input
                  className="input"
                  placeholder={t("e.g. pork-03")}
                  {...register("itemId")}
                />
                {errors.itemId && (
                  <span className="productFieldError">
                    {errors.itemId.message}
                  </span>
                )}
              </label>

              <label className="modalField">
                <span className="label">{t("Weight")}</span>
                <input
                  className="input"
                  type="number"
                  step="any"
                  placeholder={t("e.g. 30")}
                  {...register("weight")}
                />
                {errors.weight && (
                  <span className="productFieldError">
                    {errors.weight.message}
                  </span>
                )}
              </label>

              <label className="modalField">
                <span className="label">{t("Price")}</span>
                <input
                  className="input"
                  type="number"
                  step="any"
                  placeholder={t("e.g. 60000")}
                  {...register("price")}
                />
                {errors.price && (
                  <span className="productFieldError">
                    {errors.price.message}
                  </span>
                )}
              </label>

              {/* NO outlet field for live products - matches Postman API */}
              {/* NO createdBy field - removed completely */}
            </>
          )}

          <label className="modalField">
            <span className="label">{t("Status")}</span>
            <select className="select" {...register("status")}>
              <option value="Active">{t("Active")}</option>
              <option value="Inactive">{t("Inactive")}</option>
            </select>
          </label>
        </form>
      </Modal>
    </section>
  );
}