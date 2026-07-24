"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import ConfirmModal from "@/app/components/Modal/ConfirmModal";
import Modal from "@/app/components/Modal/Modal";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import { ErrorState } from "@/app/components/ui-ext/ErrorState";
import { PageHeader } from "@/app/components/ui-ext/PageHeader";
import { TableSkeleton } from "@/app/components/ui-ext/LoadingState";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { useOutletAccess } from "@/app/providers/OutletAccessProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { getOutlets, type Outlet } from "@/handlers/outlet";
import {
  createSupplier as createSupplierApi,
  deleteSupplier as deleteSupplierApi,
  getSuppliers,
  type Supplier,
  updateSupplier as updateSupplierApi,
} from "@/handlers/supplier";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import { supplierSchema, type SupplierFormValues } from "@/schema/supplier";

const SUPPLIERS_QUERY_ROOT = ["suppliers"] as const;
const OUTLETS_QUERY_KEY = ["outlets"] as const;
const DEFAULT_VALUES: SupplierFormValues = { name: "", contact: "", outletId: "" };
const npr = new Intl.NumberFormat("en-NP", {
  style: "currency",
  currency: "NPR",
  maximumFractionDigits: 2,
});

function formatDate(value: string): string {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleDateString() : value;
}

function outletName(outlets: Outlet[], outletId: string | null): string {
  if (!outletId) return "Unassigned";
  return outlets.find((outlet) => outlet.id === outletId)?.name ?? outletId;
}

function responseMessage(result: { data?: { message?: string } }): string {
  return result.data?.message?.trim() || "Supplier saved successfully.";
}

export default function SuppliersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { showToast } = useToast();
  const { authUserId } = useAuth();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { accessTier } = useOutletAccess();
  const { rowFilterOutletId, isScoped } = useRowFilterOutletId();

  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const effectiveOutletId = isScoped ? rowFilterOutletId : null;
  const queryKey = [...SUPPLIERS_QUERY_ROOT, effectiveOutletId ?? "all"] as const;

  const suppliersQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await getSuppliers(effectiveOutletId);
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

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (!isModalOpen) {
      form.reset({ ...DEFAULT_VALUES, outletId: effectiveOutletId ?? "" });
    }
  }, [effectiveOutletId, form, isModalOpen]);

  useEffect(() => {
    if (editingSupplier) {
      form.reset({
        name: editingSupplier.name,
        contact: editingSupplier.contact ?? "",
        outletId: editingSupplier.outletId ?? effectiveOutletId ?? "",
      });
    }
  }, [editingSupplier, effectiveOutletId, form]);

  const createMutation = useMutation({
    mutationFn: (values: SupplierFormValues) =>
      createSupplierApi({ ...values, createdBy: authUserId ?? undefined }),
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        form.setError("root", { message: result.error });
        showToast(result.error, "error");
        return;
      }
      setIsModalOpen(false);
      showToast(responseMessage(result), "success");
      void queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_ROOT });
    },
    onError: () => showToast(t("Something went wrong. Please try again."), "error"),
  });

  const updateMutation = useMutation({
    mutationFn: (values: SupplierFormValues & { id: string }) =>
      updateSupplierApi({ ...values, updatedBy: authUserId ?? undefined }),
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        form.setError("root", { message: result.error });
        showToast(result.error, "error");
        return;
      }
      setEditingSupplier(null);
      showToast(responseMessage(result), "success");
      void queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_ROOT });
    },
    onError: () => showToast(t("Something went wrong. Please try again."), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSupplierApi(id),
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        showToast(result.error, "error");
        return;
      }
      setSupplierToDelete(null);
      showToast(responseMessage(result), "success");
      void queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_ROOT });
    },
    onError: () => showToast(t("Something went wrong. Please try again."), "error"),
  });

  const filteredSuppliers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const items = suppliersQuery.data ?? [];
    if (!query) return items;
    return items.filter(
      (supplier) =>
        supplier.name.toLowerCase().includes(query) ||
        (supplier.contact ?? "").toLowerCase().includes(query),
    );
  }, [searchQuery, suppliersQuery.data]);

  const openCreate = () => {
    setEditingSupplier(null);
    form.reset({ ...DEFAULT_VALUES, outletId: effectiveOutletId ?? "" });
    setIsModalOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsModalOpen(true);
  };

  const onSubmit = (values: SupplierFormValues) => {
    if (editingSupplier) {
      updateMutation.mutate({ ...values, id: editingSupplier.id });
    } else {
      createMutation.mutate(values);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isManagerSurface = accessTier === "global" || accessTier === "outlet_manager";

  return (
    <section className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t("Suppliers")}
        subtitle={t("Manage suppliers used for livestock restocking.")}
        actions={
          isManagerSurface && canCreate ? (
            <Button type="button" onClick={openCreate}>
              <Plus data-icon="inline-start" aria-hidden />
              {t("Add Supplier")}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("Search suppliers")}
            className="pl-9"
          />
        </div>
        {effectiveOutletId ? (
          <p className="text-sm text-muted-foreground">
            {t("Outlet scope")}: {outletName(outlets, effectiveOutletId)}
          </p>
        ) : null}
      </div>

      {suppliersQuery.isLoading ? <TableSkeleton columns={10} /> : null}
      {suppliersQuery.isError ? (
        <ErrorState
          description={suppliersQuery.error instanceof Error ? suppliersQuery.error.message : t("Failed to load suppliers")}
          onRetry={() => void suppliersQuery.refetch()}
        />
      ) : null}
      {!suppliersQuery.isLoading && !suppliersQuery.isError && filteredSuppliers.length === 0 ? (
        <EmptyState
          title={searchQuery.trim() ? t("No suppliers match") : t("No suppliers yet. Add one to get started.")}
          action={isManagerSurface && canCreate && !searchQuery.trim() ? <Button onClick={openCreate}>{t("Add Supplier")}</Button> : undefined}
        />
      ) : null}
      {!suppliersQuery.isLoading && !suppliersQuery.isError && filteredSuppliers.length > 0 ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Name")}</TableHead>
                <TableHead>{t("Contact")}</TableHead>
                <TableHead>{t("Outlet")}</TableHead>
                <TableHead className="text-right">{t("Transactions")}</TableHead>
                <TableHead className="text-right">{t("Purchased")}</TableHead>
                <TableHead className="text-right">{t("Paid")}</TableHead>
                <TableHead className="text-right">{t("Due")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
                <TableHead>{t("Created")}</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium"><Link className="text-primary hover:underline" to={`/dashboard/product/suppliers/${encodeURIComponent(supplier.id)}${location.search}`}>{supplier.name}</Link></TableCell>
                  <TableCell className="text-muted-foreground">{supplier.contact || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{outletName(outlets, supplier.outletId)}</TableCell>
                  <TableCell className="text-right tabular-nums">{supplier.summary?.totalTransactions ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{npr.format(supplier.summary?.totalPurchasedAmount ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-700">{npr.format(supplier.summary?.totalPaidAmount ?? 0)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${(supplier.summary?.totalDueAmount ?? 0) > 0 ? "font-medium text-destructive" : ""}`}>{npr.format(supplier.summary?.totalDueAmount ?? 0)}</TableCell>
                  <TableCell>{supplier.status ? t("Active") : t("Inactive")}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(supplier.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {isManagerSurface && (canUpdate || canDelete) ? (
                      <div className="flex justify-end gap-1">
                        {canUpdate ? (
                          <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(supplier)} aria-label={t("Edit Supplier")}>
                            <MoreHorizontal className="h-4 w-4" aria-hidden />
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button type="button" variant="ghost" size="icon" onClick={() => setSupplierToDelete(supplier)} aria-label={t("Delete Supplier")}>
                            ×
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Modal
        isOpen={isModalOpen}
        title={editingSupplier ? t("Edit Supplier") : t("Add Supplier")}
        subtitle={t("Supplier contact and outlet details")}
        onClose={() => {
          if (!isPending) {
            setIsModalOpen(false);
            setEditingSupplier(null);
          }
        }}
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="supplier-name" className="text-sm font-medium">{t("Supplier name")}</label>
            <Input id="supplier-name" disabled={isPending} {...form.register("name")} />
            {form.formState.errors.name?.message ? <p className="text-sm text-destructive">{form.formState.errors.name.message}</p> : null}
          </div>
          <div className="space-y-2">
            <label htmlFor="supplier-contact" className="text-sm font-medium">{t("Contact")}</label>
            <Input id="supplier-contact" disabled={isPending} {...form.register("contact")} />
            {form.formState.errors.contact?.message ? <p className="text-sm text-destructive">{form.formState.errors.contact.message}</p> : null}
          </div>
          <div className="space-y-2">
            <label htmlFor="supplier-outlet" className="text-sm font-medium">{t("Outlet")}</label>
            <select
              id="supplier-outlet"
              disabled={isPending || Boolean(effectiveOutletId)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...form.register("outletId")}
            >
              <option value="">{t("Select outlet")}</option>
              {outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
            </select>
            {form.formState.errors.outletId?.message ? <p className="text-sm text-destructive">{form.formState.errors.outletId.message}</p> : null}
          </div>
          {form.formState.errors.root?.message ? <p className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" disabled={isPending} onClick={() => setIsModalOpen(false)}>{t("Cancel")}</Button>
            <Button type="submit" className="flex-1" disabled={isPending}>{isPending ? t("Saving...") : t("Save")}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={supplierToDelete != null}
        title={t("Delete Supplier")}
        message={t("Are you sure you want to delete this supplier?")}
        confirmLabel={t("Delete")}
        cancelLabel={t("Cancel")}
        variant="danger"
        loading={deleteMutation.isPending}
        onClose={() => setSupplierToDelete(null)}
        onConfirm={() => {
          if (supplierToDelete) deleteMutation.mutate(supplierToDelete.id);
        }}
      />
    </section>
  );
}
