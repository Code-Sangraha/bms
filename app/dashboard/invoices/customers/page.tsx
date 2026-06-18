"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { useOutletAccess } from "@/app/providers/OutletAccessProvider";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import Pagination from "@/app/components/Pagination/Pagination";
import ConfirmModal from "../../../components/Modal/ConfirmModal";
import Modal from "../../../components/Modal/Modal";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { FormField } from "@/app/components/ui-ext/FormField";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import { ErrorState } from "@/app/components/ui-ext/ErrorState";
import { TableSkeleton } from "@/app/components/ui-ext/LoadingState";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import {
  createCustomer as createCustomerApi,
  deleteCustomer as deleteCustomerApi,
  getCustomers,
  type Customer,
  updateCustomer as updateCustomerApi,
} from "@/handlers/customer";
import { getCustomerTypes } from "@/handlers/customerType";
import { getOutlets, type Outlet } from "@/handlers/outlet";
import { customerSchema, type CustomerFormValues } from "@/schema/customer";
import "./customers.scss";

const OUTLETS_QUERY_KEY = ["outlets"];
const CUSTOMER_TYPES_QUERY_KEY = ["customerTypes"];

const defaultFormValues: CustomerFormValues = {
  name: "",
  contact: "",
  outletId: "",
  customerTypeId: "",
};

function toFormValues(c: Customer): CustomerFormValues {
  return {
    name: c.name,
    contact: c.contact,
    outletId: c.outletId,
    customerTypeId: c.customerTypeId,
  };
}

function formatCreatedAt(iso: string | undefined): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleDateString();
}

function outletName(outlets: Outlet[], outletId: string): string {
  return outlets.find((o) => o.id === outletId)?.name ?? outletId;
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { accessTier } = useOutletAccess();
  const { rowFilterOutletId, isScoped } = useRowFilterOutletId();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Customer | null>(null);
  const [editingItem, setEditingItem] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [outletFilter, setOutletFilter] = useState<string>("");

  const isGlobal = accessTier === "global";
  const effectiveOutletId = isScoped
    ? rowFilterOutletId
    : outletFilter.trim() || null;

  const customersQueryKey = ["customers", effectiveOutletId ?? "all"];

  const {
    data: items = [],
    isLoading: itemsLoading,
    isError: itemsError,
    error: itemsErrorDetail,
  } = useQuery({
    queryKey: customersQueryKey,
    queryFn: async () => {
      const result = await getCustomers(effectiveOutletId);
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

  const { data: customerTypes = [] } = useQuery({
    queryKey: CUSTOMER_TYPES_QUERY_KEY,
    queryFn: async () => {
      const result = await getCustomerTypes();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data.filter((ct) => ct.status);
    },
  });

  const defaultOutletId = effectiveOutletId ?? "";

  const addForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { ...defaultFormValues, outletId: defaultOutletId },
  });

  const editForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: defaultFormValues,
  });

  useEffect(() => {
    if (!isModalOpen) {
      addForm.reset({ ...defaultFormValues, outletId: defaultOutletId });
    }
  }, [isModalOpen, defaultOutletId, addForm.reset]);

  useEffect(() => {
    if (editingItem) editForm.reset(toFormValues(editingItem));
  }, [editingItem, editForm.reset]);

  const createMutation = useMutation({
    mutationFn: (values: CustomerFormValues) => createCustomerApi(values),
    onSuccess: (result) => {
      if (result.ok) {
        setIsModalOpen(false);
        void queryClient.invalidateQueries({ queryKey: ["customers"] });
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
    mutationFn: ({ id, values }: { id: string; values: CustomerFormValues }) =>
      updateCustomerApi(id, values),
    onSuccess: (result) => {
      if (result.ok) {
        setEditingItem(null);
        void queryClient.invalidateQueries({ queryKey: ["customers"] });
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
    mutationFn: (id: string) => deleteCustomerApi(id),
    onSuccess: (result) => {
      if (result.ok) {
        setItemToDelete(null);
        void queryClient.invalidateQueries({ queryKey: ["customers"] });
      } else {
        if (result.status === 401) navigate("/login");
      }
    },
  });

  const onAddSubmit = (data: CustomerFormValues) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: CustomerFormValues) => {
    if (editingItem) updateMutation.mutate({ id: editingItem.id, values: data });
  };

  const handleConfirmDelete = () => {
    if (itemToDelete) deleteMutation.mutate(itemToDelete.id);
  };

  const addLoading = addForm.formState.isSubmitting || createMutation.isPending;
  const editLoading =
    editForm.formState.isSubmitting || updateMutation.isPending;

  const outletLocked = Boolean(effectiveOutletId);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.contact.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(filteredItems.length, { defaultPageSize: 10 });
  const paginatedItems = useMemo(
    () => paginate(filteredItems, startIndex, endIndex),
    [filteredItems, startIndex, endIndex]
  );

  const renderCustomerFormFields = (
    form: ReturnType<typeof useForm<CustomerFormValues>>,
    idPrefix: string
  ) => {
    const { register, control, formState: { errors } } = form;
    return (
      <>
        {errors.root?.message && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}
        <FormField
          id={`${idPrefix}-name`}
          label={t("Name")}
          required
          error={errors.name?.message}
        >
          <Input
            id={`${idPrefix}-name`}
            placeholder={t("Customer name")}
            aria-invalid={Boolean(errors.name)}
            {...register("name")}
          />
        </FormField>
        <FormField
          id={`${idPrefix}-contact`}
          label={t("Contact")}
          required
          error={errors.contact?.message}
        >
          <Input
            id={`${idPrefix}-contact`}
            placeholder={t("Phone or email")}
            aria-invalid={Boolean(errors.contact)}
            {...register("contact")}
          />
        </FormField>
        <FormField
          id={`${idPrefix}-outlet`}
          label={t("Outlet")}
          required
          error={errors.outletId?.message}
        >
          <Controller
            control={control}
            name="outletId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={outletLocked}
              >
                <SelectTrigger
                  id={`${idPrefix}-outlet`}
                  aria-invalid={Boolean(errors.outletId)}
                >
                  <SelectValue placeholder={t("Select outlet")} />
                </SelectTrigger>
                <SelectContent>
                  {outlets.map((o) => (
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
          id={`${idPrefix}-type`}
          label={t("Customer Type")}
          required
          error={errors.customerTypeId?.message}
        >
          <Controller
            control={control}
            name="customerTypeId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id={`${idPrefix}-type`}
                  aria-invalid={Boolean(errors.customerTypeId)}
                >
                  <SelectValue placeholder={t("Select customer type")} />
                </SelectTrigger>
                <SelectContent>
                  {customerTypes.map((ct) => (
                    <SelectItem key={ct.id} value={ct.id}>
                      {ct.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </>
    );
  };

  return (
    <section className="customersPage">
      <div className="breadcrumb">
        <span>{t("Sales & Billing")}</span> {"›"} {t("Customers")}
      </div>

      <div className="customersHeader">
        <div className="customersHeaderText">
          <h1 className="pageTitle">{t("Customers")}</h1>
          <p className="pageSubtitle">
            {t("Manage customer records linked to outlets and customer types")}
          </p>
        </div>
        {canCreate && (
          <Button type="button" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t("Add Customer")}
          </Button>
        )}
      </div>

      <div className="customersToolbar">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder={t("Search customers")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t("Search customers")}
            className="pl-8"
          />
        </div>
        {isGlobal && !isScoped && (
          <Select
            value={outletFilter || "__all__"}
            onValueChange={(v) => setOutletFilter(v === "__all__" ? "" : v)}
          >
            <SelectTrigger
              className="w-full sm:w-56"
              aria-label={t("Filter by outlet")}
            >
              <SelectValue placeholder={t("All outlets")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("All outlets")}</SelectItem>
              {outlets.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {itemsLoading && <TableSkeleton rows={6} columns={6} />}
      {itemsError && (
        <ErrorState
          title={t("Failed to load")}
          description={
            itemsErrorDetail instanceof Error
              ? itemsErrorDetail.message
              : t("We couldn't load this section. Please try again.")
          }
        />
      )}
      {!itemsLoading && !itemsError && items.length === 0 && (
        <EmptyState
          title={t("No customers yet. Add one to get started.")}
          action={
            canCreate ? (
              <Button type="button" onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                {t("Add Customer")}
              </Button>
            ) : undefined
          }
        />
      )}
      {!itemsLoading &&
        !itemsError &&
        items.length > 0 &&
        filteredItems.length === 0 && (
          <EmptyState title={`${t("No items match")} "${searchQuery.trim()}"`} />
        )}
      {!itemsLoading && !itemsError && filteredItems.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Name")}</TableHead>
                <TableHead>{t("Contact")}</TableHead>
                <TableHead>{t("Outlet")}</TableHead>
                <TableHead>{t("Customer Type")}</TableHead>
                <TableHead>{t("Created")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.contact}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {outletName(outlets, c.outletId)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.customerType?.name ?? c.customerTypeId}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatCreatedAt(c.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {(canUpdate || canDelete) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            aria-label={t("More options")}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          {canUpdate && (
                            <DropdownMenuItem
                              onSelect={() => setEditingItem(c)}
                            >
                              {t("Edit")}
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setItemToDelete(c)}
                            >
                              {t("Delete")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!itemsLoading && !itemsError && filteredItems.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredItems.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          pageSizeOptions={[10, 20, 50]}
          onPageSizeChange={setPageSize}
        />
      )}

      <ConfirmModal
        isOpen={!!itemToDelete}
        title={t("Delete customer")}
        message={
          itemToDelete
            ? `${t("Are you sure you want to delete")} "${itemToDelete.name}"? ${t(
                "This action cannot be undone."
              )}`
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
        isOpen={!!editingItem}
        title={t("Edit Customer")}
        subtitle={editingItem?.name}
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
              form="edit-customer-form"
              disabled={editLoading}
            >
              {editLoading ? t("Saving…") : t("Save")}
            </Button>
          </>
        }
      >
        <form
          id="edit-customer-form"
          onSubmit={editForm.handleSubmit(onEditSubmit)}
          className="flex flex-col gap-4"
        >
          {renderCustomerFormFields(editForm, "edit-customer")}
        </form>
      </Modal>

      <Modal
        isOpen={isModalOpen}
        title={t("Add Customer")}
        subtitle={t("Create a new customer record")}
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
              form="add-customer-form"
              disabled={addLoading}
            >
              {addLoading ? t("Saving…") : t("Save")}
            </Button>
          </>
        }
      >
        <form
          id="add-customer-form"
          onSubmit={addForm.handleSubmit(onAddSubmit)}
          className="flex flex-col gap-4"
        >
          {renderCustomerFormFields(addForm, "add-customer")}
        </form>
      </Modal>
    </section>
  );
}
