"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  Controller,
  useForm,
  type Resolver,
  type SubmitHandler,
} from "react-hook-form";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import ConfirmModal from "../../components/Modal/ConfirmModal";
import Modal from "../../components/Modal/Modal";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { FormField } from "@/app/components/ui-ext/FormField";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import { ErrorState } from "@/app/components/ui-ext/ErrorState";
import { CardGridSkeleton } from "@/app/components/ui-ext/LoadingState";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import {
  createDualPricing as createDualPricingApi,
  deleteDualPricing as deleteDualPricingApi,
  getDualPricings,
  type DualPricing,
  updateDualPricing as updateDualPricingApi,
} from "@/handlers/dualPricing";
import { getOutlets, type Outlet } from "@/handlers/outlet";
import { getProducts, type Product } from "@/handlers/product";
import { formatNameWithOutlet, productOutletId } from "@/lib/productDisplay";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { capabilities } = usePermissions();
  const { t } = useI18n();
  const { isScoped, rowFilterOutletId } = useRowFilterOutletId();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DualPricing | null>(null);
  const [editingItem, setEditingItem] = useState<DualPricing | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [outletFilter, setOutletFilter] = useState("all");

  useEffect(() => {
    if (isScoped && rowFilterOutletId) setOutletFilter(rowFilterOutletId);
  }, [isScoped, rowFilterOutletId]);

  const effectiveOutletFilter =
    isScoped && rowFilterOutletId ? rowFilterOutletId : outletFilter;

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
        if (result.status === 401) navigate("/login");
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
        if (result.status === 401) navigate("/login");
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
        if (result.status === 401) navigate("/login");
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

  const addOutletId = addForm.watch("outletId");
  const editOutletId = editForm.watch("outletId");

  const productsForAddOutlet = useMemo(() => {
    if (!addOutletId) return [];
    return products.filter((p) => productOutletId(p) === addOutletId);
  }, [products, addOutletId]);

  const productsForEditOutlet = useMemo(() => {
    if (!editOutletId) return [];
    return products.filter((p) => productOutletId(p) === editOutletId);
  }, [products, editOutletId]);

  useEffect(() => {
    if (!isModalOpen) return;
    if (!addOutletId) {
      addForm.setValue("productId", "");
      return;
    }
    const pid = addForm.getValues("productId");
    if (!pid) return;
    const ok = productsForAddOutlet.some((p) => p.id === pid);
    if (!ok) addForm.setValue("productId", "");
  }, [isModalOpen, addOutletId, productsForAddOutlet, addForm]);

  useEffect(() => {
    if (!editingItem) return;
    if (!editOutletId) {
      editForm.setValue("productId", "");
      return;
    }
    const pid = editForm.getValues("productId");
    if (!pid) return;
    const ok = productsForEditOutlet.some((p) => p.id === pid);
    if (!ok) editForm.setValue("productId", "");
  }, [editingItem, editOutletId, productsForEditOutlet, editForm]);

  const createMutation = useMutation({
    mutationFn: (values: DualPricingFormValues) =>
      createDualPricingApi(values),
    onSuccess: (result) => {
      if (result.ok) {
        setIsModalOpen(false);
        queryClient.invalidateQueries({ queryKey: DUAL_PRICING_QUERY_KEY });
      } else {
        if (result.status === 401) navigate("/login");
        else addForm.setError("root", { message: result.error });
      }
    },
    onError: () => {
      addForm.setError("root", {
        message: t("Something went wrong. Please try again."),
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
        if (result.status === 401) navigate("/login");
        else editForm.setError("root", { message: result.error });
      }
    },
    onError: () => {
      editForm.setError("root", {
        message: t("Something went wrong. Please try again."),
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
        if (result.status === 401) navigate("/login");
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

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (effectiveOutletFilter !== "all" && item.outletId !== effectiveOutletFilter) {
        return false;
      }
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      const labeled = formatNameWithOutlet(
        getProductName(item),
        getOutletName(item)
      );
      return (
        labeled.toLowerCase().includes(q) ||
        String(item.wholesalePrice).includes(q) ||
        String(item.retailPrice).includes(q)
      );
    });
  }, [items, effectiveOutletFilter, searchQuery, products, outlets]);

  const getMarginPercent = (retail: number, wholesale: number) => {
    if (retail <= 0) return 0;
    return Math.round(((retail - wholesale) / retail) * 1000) / 10;
  };

  const formatPrice = (value: number) => `Rs.${value}`;

  return (
    <section className="dualPricingPage">
      <div className="breadcrumb">
        <span>{t("Product")}</span> {"›"} {t("Pricelist")}
      </div>

      <div className="dualPricingHeader">
        <div className="dualPricingHeaderText">
          <h1 className="pageTitle">{t("Dual Pricing System")}</h1>
          <p className="pageSubtitle">
            {t("Manage retail and wholesale pricing")}
          </p>
        </div>
        {capabilities.canEditDualPricing && (
          <Button
            type="button"
            className="dualPricingUpgradeBtn"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("Upgrade Price")}
          </Button>
        )}
      </div>

      <div className="dualPricingFilters">
        {!isScoped ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              {t("Outlet")}
            </span>
            <Select value={outletFilter} onValueChange={setOutletFilter}>
              <SelectTrigger
                className="w-[200px]"
                aria-label={t("Filter by outlet")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Outlets")}</SelectItem>
                {outlets.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder={t("Search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t("Search dual pricing")}
            className="pl-8"
          />
        </div>
      </div>

      {itemsLoading && <CardGridSkeleton items={6} />}
      {itemsError && (
        <ErrorState
          title={t("Failed to load")}
          description={
            itemsErrorDetail instanceof Error
              ? itemsErrorDetail.message
              : undefined
          }
        />
      )}
      {!itemsLoading && !itemsError && items.length === 0 && (
        <EmptyState
          title={t("No dual pricing yet. Add one to get started.")}
          action={
            capabilities.canEditDualPricing ? (
              <Button type="button" onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                {t("Upgrade Price")}
              </Button>
            ) : undefined
          }
        />
      )}
      {!itemsLoading &&
        !itemsError &&
        items.length > 0 &&
        filteredItems.length === 0 && (
          <EmptyState
            title={
              searchQuery.trim()
                ? `${t("No items match")} "${searchQuery.trim()}"`
                : effectiveOutletFilter !== "all"
                  ? t("No dual pricing for this outlet.")
                  : t("No items match your filters.")
            }
          />
        )}
      {!itemsLoading && !itemsError && filteredItems.length > 0 && (
        <div className="dualPricingCardGrid">
          {filteredItems.map((item) => (
            <div key={item.id} className="dualPricingCard">
              <div className="dualPricingCardTop">
                <h3 className="dualPricingCardTitle">
                  {formatNameWithOutlet(
                    getProductName(item),
                    getOutletName(item)
                  )}
                </h3>
                {capabilities.canEditDualPricing && (
                  <div className="dualPricingCardActions">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setItemToDelete(item)}
                      aria-label={t("Delete")}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingItem(item)}
                      aria-label={t("Edit")}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                )}
              </div>
              <div className="dualPricingCardBody">
                <p className="dualPricingCardRow">
                  <span className="dualPricingCardLabel">{t("Retail Price")}:</span>{" "}
                  <span className="dualPricingCardValue">{formatPrice(item.retailPrice)}</span>
                </p>
                <p className="dualPricingCardRow">
                  <span className="dualPricingCardLabel">{t("Wholesale Price")}:</span>{" "}
                  <span className="dualPricingCardValue">{formatPrice(item.wholesalePrice)}</span>
                </p>
              </div>
              <div className="dualPricingCardFooter">
                <span className="dualPricingCardMetric">
                  {t("Margin")}: {getMarginPercent(item.retailPrice, item.wholesalePrice)}%
                </span>
                <span className="dualPricingCardMetricDivider" />
                <span className="dualPricingCardMetric">
                  {t("Cost")}: {formatPrice(item.wholesalePrice)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!itemToDelete && capabilities.canEditDualPricing}
        title={t("Delete dual pricing")}
        message={
          itemToDelete
            ? t("Are you sure you want to delete this dual pricing entry? This action cannot be undone.")
            : ""
        }
        confirmLabel={t("Delete")}
        cancelLabel={t("Cancel")}
        variant="danger"
        loading={deleteMutation.isPending}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      <Modal
        isOpen={!!editingItem && capabilities.canEditDualPricing}
        title={t("Edit dual pricing")}
        subtitle={editingItem?.id}
        onClose={() => setEditingItem(null)}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingItem(null)}
            >
              {t("Discard")}
            </Button>
            <Button
              type="submit"
              form="edit-dual-pricing-form"
              disabled={editLoading}
            >
              {editLoading ? t("Saving…") : t("Save")}
            </Button>
          </>
        }
      >
        <form
          id="edit-dual-pricing-form"
          onSubmit={editForm.handleSubmit(onEditSubmit)}
          className="space-y-4"
        >
          {editForm.formState.errors.root?.message && (
            <Alert variant="destructive">
              <AlertDescription>
                {editForm.formState.errors.root.message}
              </AlertDescription>
            </Alert>
          )}
          <FormField
            label={t("Outlet")}
            error={editForm.formState.errors.outletId?.message}
          >
            <Controller
              control={editForm.control}
              name="outletId"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select outlet")} />
                  </SelectTrigger>
                  <SelectContent>
                    {outlets.map((o: Outlet) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField
            label={t("Product")}
            error={editForm.formState.errors.productId?.message}
          >
            <Controller
              control={editForm.control}
              name="productId"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  disabled={!editOutletId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        editOutletId ? t("Select product") : t("Select outlet first")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {productsForEditOutlet.map((p: Product) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField
            label={t("Wholesale price")}
            error={editForm.formState.errors.wholesalePrice?.message}
          >
            <Input
              type="number"
              min={0}
              step={0.01}
              {...editForm.register("wholesalePrice")}
            />
          </FormField>
          <FormField
            label={t("Retail price")}
            error={editForm.formState.errors.retailPrice?.message}
          >
            <Input
              type="number"
              min={0}
              step={0.01}
              {...editForm.register("retailPrice")}
            />
          </FormField>
          <FormField label={t("Status")}>
            <Controller
              control={editForm.control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">{t("Active")}</SelectItem>
                    <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </form>
      </Modal>

      <Modal
        isOpen={isModalOpen}
        title={t("Add dual pricing")}
        subtitle={t("Set wholesale and retail prices for a product at an outlet")}
        onClose={() => setIsModalOpen(false)}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              {t("Discard")}
            </Button>
            <Button
              type="submit"
              form="add-dual-pricing-form"
              disabled={addLoading}
            >
              {addLoading ? t("Saving…") : t("Save")}
            </Button>
          </>
        }
      >
        <form
          id="add-dual-pricing-form"
          onSubmit={addForm.handleSubmit(onAddSubmit)}
          className="space-y-4"
        >
          {addForm.formState.errors.root?.message && (
            <Alert variant="destructive">
              <AlertDescription>
                {addForm.formState.errors.root.message}
              </AlertDescription>
            </Alert>
          )}
          <FormField
            label={t("Outlet")}
            error={addForm.formState.errors.outletId?.message}
          >
            <Controller
              control={addForm.control}
              name="outletId"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select outlet")} />
                  </SelectTrigger>
                  <SelectContent>
                    {outlets.map((o: Outlet) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField
            label={t("Product")}
            error={addForm.formState.errors.productId?.message}
          >
            <Controller
              control={addForm.control}
              name="productId"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  disabled={!addOutletId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        addOutletId ? t("Select product") : t("Select outlet first")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {productsForAddOutlet.map((p: Product) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField
            label={t("Wholesale price")}
            error={addForm.formState.errors.wholesalePrice?.message}
          >
            <Input
              type="number"
              min={0}
              step={0.01}
              {...addForm.register("wholesalePrice")}
            />
          </FormField>
          <FormField
            label={t("Retail price")}
            error={addForm.formState.errors.retailPrice?.message}
          >
            <Input
              type="number"
              min={0}
              step={0.01}
              {...addForm.register("retailPrice")}
            />
          </FormField>
          <FormField label={t("Status")}>
            <Controller
              control={addForm.control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">{t("Active")}</SelectItem>
                    <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </form>
      </Modal>
    </section>
  );
}
