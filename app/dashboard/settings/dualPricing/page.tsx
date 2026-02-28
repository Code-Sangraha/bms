"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, type Resolver, type SubmitHandler } from "react-hook-form";
import { usePermissions } from "@/app/providers/AuthProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import ConfirmModal from "../../../components/Modal/ConfirmModal";
import Modal from "../../../components/Modal/Modal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import {
  createDualPricing as createDualPricingApi,
  deleteDualPricing as deleteDualPricingApi,
  getDualPricings,
  type DualPricing,
  updateDualPricing as updateDualPricingApi,
} from "@/handlers/dualPricing";
import { getOutlets } from "@/handlers/outlet";
import { getProducts } from "@/handlers/product";
import {
  dualPricingSchema,
  type DualPricingFormValues,
} from "@/schema/dualPricing";
import "./dualPricing.scss";

const DUAL_PRICING_QUERY_KEY = ["dualPricing"];
const PRODUCTS_QUERY_KEY = ["products"];
const OUTLETS_QUERY_KEY = ["outlets"];

const defaultFormValues: DualPricingFormValues = {
  productId: "",
  wholesalePrice: 0,
  retailPrice: 0,
  outletId: "",
  status: "Active",
};

function toFormValues(d: DualPricing): DualPricingFormValues {
  return {
    productId: d.productId,
    wholesalePrice: d.wholesalePrice ?? 0,
    retailPrice: d.retailPrice ?? 0,
    outletId: d.outletId,
    status: d.status ? "Active" : "Inactive",
  };
}

function resolveName(
  value: string | { name: string } | undefined,
  fallback: string
): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "name" in value) return value.name;
  return fallback;
}

export default function DualPricingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DualPricing | null>(null);
  const [editingItem, setEditingItem] = useState<DualPricing | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: items = [],
    isLoading: itemsLoading,
    isError: itemsError,
    error: itemsErrorDetail,
  } = useQuery({
    queryKey: DUAL_PRICING_QUERY_KEY,
    queryFn: async () => {
      const result = await getDualPricings();
      if (!result.ok) {
        if (result.status === 401) router.push("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: async () => {
      const result = await getProducts();
      if (!result.ok) {
        if (result.status === 401) router.push("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const { data: outlets = [] } = useQuery({
    queryKey: OUTLETS_QUERY_KEY,
    queryFn: async () => {
      const result = await getOutlets();
      if (!result.ok) {
        if (result.status === 401) router.push("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const addForm = useForm<DualPricingFormValues>({
    resolver: zodResolver(dualPricingSchema) as Resolver<DualPricingFormValues>,
    defaultValues: defaultFormValues,
  });

  const editForm = useForm<DualPricingFormValues>({
    resolver: zodResolver(dualPricingSchema) as Resolver<DualPricingFormValues>,
    defaultValues: defaultFormValues,
  });

  useEffect(() => {
    if (!isModalOpen) addForm.reset(defaultFormValues);
  }, [isModalOpen, addForm.reset]);

  useEffect(() => {
    if (editingItem) editForm.reset(toFormValues(editingItem));
  }, [editingItem, editForm.reset]);

  const createMutation = useMutation({
    mutationFn: (values: DualPricingFormValues) =>
      createDualPricingApi(values),
    onSuccess: (result) => {
      if (result.ok) {
        setIsModalOpen(false);
        queryClient.invalidateQueries({ queryKey: DUAL_PRICING_QUERY_KEY });
      } else {
        if (result.status === 401) router.push("/login");
        else addForm.setError("root", { message: result.error });
      }
    },
    onError: () => {
      addForm.setError("root", {
        message: "Something went wrong. Please try again.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: DualPricingFormValues;
    }) => updateDualPricingApi(id, values),
    onSuccess: (result) => {
      if (result.ok) {
        setEditingItem(null);
        queryClient.invalidateQueries({ queryKey: DUAL_PRICING_QUERY_KEY });
      } else {
        if (result.status === 401) router.push("/login");
        else editForm.setError("root", { message: result.error });
      }
    },
    onError: () => {
      editForm.setError("root", {
        message: "Something went wrong. Please try again.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDualPricingApi(id),
    onSuccess: (result) => {
      if (result.ok) {
        setItemToDelete(null);
        queryClient.invalidateQueries({ queryKey: DUAL_PRICING_QUERY_KEY });
      } else {
        if (result.status === 401) router.push("/login");
      }
    },
  });

  const onAddSubmit: SubmitHandler<DualPricingFormValues> = (data) => {
    createMutation.mutate(data);
  };

  const onEditSubmit: SubmitHandler<DualPricingFormValues> = (data) => {
    if (editingItem) updateMutation.mutate({ id: editingItem.id, values: data });
  };

  const handleConfirmDelete = () => {
    if (itemToDelete) deleteMutation.mutate(itemToDelete.id);
  };

  const addLoading = addForm.formState.isSubmitting || createMutation.isPending;
  const editLoading =
    editForm.formState.isSubmitting || updateMutation.isPending;

  const getProductName = (item: DualPricing) => {
    const name = resolveName(item.product, "");
    if (name) return name;
    const p = products.find((x) => x.id === item.productId);
    return p?.name ?? item.productId ?? "—";
  };

  const getOutletName = (item: DualPricing) => {
    const name = resolveName(item.outlet, "");
    if (name) return name;
    const o = outlets.find((x) => x.id === item.outletId);
    return o?.name ?? item.outletId ?? "—";
  };

  const filteredItems = items.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      getProductName(item).toLowerCase().includes(q) ||
      getOutletName(item).toLowerCase().includes(q) ||
      String(item.wholesalePrice).includes(q) ||
      String(item.retailPrice).includes(q)
    );
  });

  const getMarginPercent = (retail: number, wholesale: number) => {
    if (retail <= 0) return 0;
    return Math.round(((retail - wholesale) / retail) * 1000) / 10;
  };

  const formatPrice = (value: number) => `Rs.${value}`;

  return (
    <section className="dualPricingPage">
      <div className="breadcrumb">
        <span>Sales & Billing</span> {"›"} Pricelist
      </div>

      <div className="dualPricingHeader">
        <div className="dualPricingHeaderText">
          <h1 className="pageTitle">Dual Pricing System</h1>
          <p className="pageSubtitle">
            Manage retail and wholesale pricing
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="button buttonPrimary dualPricingUpgradeBtn"
            onClick={() => setIsModalOpen(true)}
          >
            Upgrade Price
          </button>
        )}
      </div>

      <div className="dualPricingSearch">
        <span className="searchIcon">🔍</span>
        <input
          className="searchInput"
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search dual pricing"
        />
      </div>

      <div className="dualPricingCardGrid">
        {itemsLoading && (
          <div className="dualPricingCardMessage">Loading…</div>
        )}
        {itemsError && (
          <div className="dualPricingCardMessage dualPricingError">
            {itemsErrorDetail instanceof Error
              ? itemsErrorDetail.message
              : "Failed to load"}
          </div>
        )}
        {!itemsLoading && !itemsError && items.length === 0 && (
          <div className="dualPricingCardMessage">
            No dual pricing yet. Add one to get started.
          </div>
        )}
        {!itemsLoading &&
          !itemsError &&
          items.length > 0 &&
          filteredItems.length === 0 && (
            <div className="dualPricingCardMessage">
              No items match &quot;{searchQuery.trim()}&quot;.
            </div>
          )}
        {!itemsLoading &&
          !itemsError &&
          filteredItems.map((item) => (
            <div key={item.id} className="dualPricingCard">
              <div className="dualPricingCardTop">
                <h3 className="dualPricingCardTitle">{getProductName(item)}</h3>
                {(canUpdate || canDelete) && (
                  <div className="dualPricingCardActions">
                    {canDelete && (
                      <button
                        type="button"
                        className="dualPricingCardIconBtn"
                        onClick={() => setItemToDelete(item)}
                        aria-label="Delete"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    )}
                    {canUpdate && (
                      <button
                        type="button"
                        className="dualPricingCardIconBtn"
                        onClick={() => setEditingItem(item)}
                        aria-label="Edit"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="dualPricingCardBody">
                <p className="dualPricingCardRow">
                  <span className="dualPricingCardLabel">Retail Price:</span>{" "}
                  <span className="dualPricingCardValue">{formatPrice(item.retailPrice)}</span>
                </p>
                <p className="dualPricingCardRow">
                  <span className="dualPricingCardLabel">Wholesale Price:</span>{" "}
                  <span className="dualPricingCardValue">{formatPrice(item.wholesalePrice)}</span>
                </p>
              </div>
              <div className="dualPricingCardFooter">
                <span className="dualPricingCardMetric">
                  Margin: {getMarginPercent(item.retailPrice, item.wholesalePrice)}%
                </span>
                <span className="dualPricingCardMetricDivider" />
                <span className="dualPricingCardMetric">
                  Cost: {formatPrice(item.wholesalePrice)}
                </span>
              </div>
            </div>
          ))}
      </div>

      <ConfirmModal
        isOpen={!!itemToDelete}
        title="Delete dual pricing"
        message={
          itemToDelete
            ? `Are you sure you want to delete this dual pricing entry? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleteMutation.isPending}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      <Modal
        isOpen={!!editingItem}
        title="Edit dual pricing"
        subtitle={editingItem?.id}
        onClose={() => setEditingItem(null)}
        footer={
          <>
            <button
              type="button"
              className="button modalButton"
              onClick={() => setEditingItem(null)}
            >
              Discard
            </button>
            <button
              type="submit"
              form="edit-dual-pricing-form"
              className="button buttonPrimary modalButton"
              disabled={editLoading}
            >
              {editLoading ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form
          id="edit-dual-pricing-form"
          onSubmit={editForm.handleSubmit(onEditSubmit)}
          className="dualPricingAddForm"
        >
          {editForm.formState.errors.root?.message && (
            <p className="dualPricingFormError">
              {editForm.formState.errors.root.message}
            </p>
          )}
          <label className="modalField">
            <span className="label">Product</span>
            <select className="select" {...editForm.register("productId")}>
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {editForm.formState.errors.productId && (
              <span className="dualPricingFieldError">
                {editForm.formState.errors.productId.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Outlet</span>
            <select className="select" {...editForm.register("outletId")}>
              <option value="">Select outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            {editForm.formState.errors.outletId && (
              <span className="dualPricingFieldError">
                {editForm.formState.errors.outletId.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Wholesale price</span>
            <input
              type="number"
              min={0}
              step={0.01}
              className="input"
              {...editForm.register("wholesalePrice")}
            />
            {editForm.formState.errors.wholesalePrice && (
              <span className="dualPricingFieldError">
                {editForm.formState.errors.wholesalePrice.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Retail price</span>
            <input
              type="number"
              min={0}
              step={0.01}
              className="input"
              {...editForm.register("retailPrice")}
            />
            {editForm.formState.errors.retailPrice && (
              <span className="dualPricingFieldError">
                {editForm.formState.errors.retailPrice.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Status</span>
            <select className="select" {...editForm.register("status")}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
        </form>
      </Modal>

      <Modal
        isOpen={isModalOpen}
        title="Add dual pricing"
        subtitle="Set wholesale and retail prices for a product at an outlet"
        onClose={() => setIsModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="button modalButton"
              onClick={() => setIsModalOpen(false)}
            >
              Discard
            </button>
            <button
              type="submit"
              form="add-dual-pricing-form"
              className="button buttonPrimary modalButton"
              disabled={addLoading}
            >
              {addLoading ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form
          id="add-dual-pricing-form"
          onSubmit={addForm.handleSubmit(onAddSubmit)}
          className="dualPricingAddForm"
        >
          {addForm.formState.errors.root?.message && (
            <p className="dualPricingFormError">
              {addForm.formState.errors.root.message}
            </p>
          )}
          <label className="modalField">
            <span className="label">Product</span>
            <select className="select" {...addForm.register("productId")}>
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {addForm.formState.errors.productId && (
              <span className="dualPricingFieldError">
                {addForm.formState.errors.productId.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Outlet</span>
            <select className="select" {...addForm.register("outletId")}>
              <option value="">Select outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            {addForm.formState.errors.outletId && (
              <span className="dualPricingFieldError">
                {addForm.formState.errors.outletId.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Wholesale price</span>
            <input
              type="number"
              min={0}
              step={0.01}
              className="input"
              {...addForm.register("wholesalePrice")}
            />
            {addForm.formState.errors.wholesalePrice && (
              <span className="dualPricingFieldError">
                {addForm.formState.errors.wholesalePrice.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Retail price</span>
            <input
              type="number"
              min={0}
              step={0.01}
              className="input"
              {...addForm.register("retailPrice")}
            />
            {addForm.formState.errors.retailPrice && (
              <span className="dualPricingFieldError">
                {addForm.formState.errors.retailPrice.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Status</span>
            <select className="select" {...addForm.register("status")}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
        </form>
      </Modal>
    </section>
  );
}
