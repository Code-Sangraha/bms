"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import ConfirmModal from "../../../components/Modal/ConfirmModal";
import Modal from "../../../components/Modal/Modal";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
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
  createCustomerType as createCustomerTypeApi,
  deleteCustomerType as deleteCustomerTypeApi,
  getCustomerTypes,
  type CustomerType,
  updateCustomerType as updateCustomerTypeApi,
} from "@/handlers/customerType";
import {
  createCustomerTypeSchema,
  type CreateCustomerTypeFormValues,
} from "@/schema/customerType";
import "./customerTypes.scss";

const CUSTOMER_TYPES_QUERY_KEY = ["customerTypes"];

const defaultAddFormValues: CreateCustomerTypeFormValues = {
  name: "",
  status: "Active",
};

function toFormValues(ct: CustomerType): CreateCustomerTypeFormValues {
  return {
    name: ct.name,
    status: ct.status ? "Active" : "Inactive",
  };
}

export default function CustomerTypesPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<CustomerType | null>(null);
  const [editingItem, setEditingItem] = useState<CustomerType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: items = [],
    isLoading: itemsLoading,
    isError: itemsError,
    error: itemsErrorDetail,
  } = useQuery({
    queryKey: CUSTOMER_TYPES_QUERY_KEY,
    queryFn: async () => {
      const result = await getCustomerTypes();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const addForm = useForm<CreateCustomerTypeFormValues>({
    resolver: zodResolver(createCustomerTypeSchema),
    defaultValues: defaultAddFormValues,
  });

  const editForm = useForm<CreateCustomerTypeFormValues>({
    resolver: zodResolver(createCustomerTypeSchema),
    defaultValues: defaultAddFormValues,
  });

  useEffect(() => {
    if (!isModalOpen) addForm.reset(defaultAddFormValues);
  }, [isModalOpen, addForm.reset]);

  useEffect(() => {
    if (editingItem) editForm.reset(toFormValues(editingItem));
  }, [editingItem, editForm.reset]);

  const createMutation = useMutation({
    mutationFn: (values: CreateCustomerTypeFormValues) =>
      createCustomerTypeApi(values),
    onSuccess: (result) => {
      if (result.ok) {
        setIsModalOpen(false);
        queryClient.invalidateQueries({ queryKey: CUSTOMER_TYPES_QUERY_KEY });
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
      values: CreateCustomerTypeFormValues;
    }) => updateCustomerTypeApi(id, values),
    onSuccess: (result) => {
      if (result.ok) {
        setEditingItem(null);
        queryClient.invalidateQueries({ queryKey: CUSTOMER_TYPES_QUERY_KEY });
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
    mutationFn: (id: string) => deleteCustomerTypeApi(id),
    onSuccess: (result) => {
      if (result.ok) {
        setItemToDelete(null);
        queryClient.invalidateQueries({ queryKey: CUSTOMER_TYPES_QUERY_KEY });
      } else {
        if (result.status === 401) navigate("/login");
      }
    },
  });

  const onAddSubmit = (data: CreateCustomerTypeFormValues) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: CreateCustomerTypeFormValues) => {
    if (editingItem) updateMutation.mutate({ id: editingItem.id, values: data });
  };

  const handleConfirmDelete = () => {
    if (itemToDelete) deleteMutation.mutate(itemToDelete.id);
  };

  const addLoading = addForm.formState.isSubmitting || createMutation.isPending;
  const editLoading =
    editForm.formState.isSubmitting || updateMutation.isPending;

  const filteredItems = useMemo(
    () =>
      items.filter((ct) =>
        ct.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ),
    [items, searchQuery]
  );

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

  return (
    <section className="customerTypesPage">
      <div className="breadcrumb">
        <span>{t("Sales & Billing")}</span> {"›"} {t("Customer Types")}
      </div>

      <div className="customerTypesHeader">
        <div className="customerTypesHeaderText">
          <h1 className="pageTitle">{t("Customer Types")}</h1>
          <p className="pageSubtitle">
            {t("Manage customer types for retail and wholesale")}
          </p>
        </div>
        {canCreate && (
          <Button type="button" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t("Add Customer Type")}
          </Button>
        )}
      </div>

      <div className="relative w-full sm:max-w-sm">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          placeholder={t("Search customer types")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t("Search customer types")}
          className="pl-8"
        />
      </div>

      {itemsLoading && <TableSkeleton rows={5} columns={3} />}
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
          title={t("No customer types yet. Add one to get started.")}
          action={
            canCreate ? (
              <Button type="button" onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                {t("Add Customer Type")}
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
                <TableHead>{t("Status")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((ct) => (
                <TableRow key={ct.id}>
                  <TableCell className="font-medium">{ct.name}</TableCell>
                  <TableCell>
                    <Badge variant={ct.status ? "success" : "secondary"}>
                      {ct.status ? t("Active") : t("Inactive")}
                    </Badge>
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
                              onSelect={() => setEditingItem(ct)}
                            >
                              {t("Edit")}
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setItemToDelete(ct)}
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
        title={t("Delete customer type")}
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
        title={t("Edit Customer Type")}
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
              form="edit-customer-type-form"
              disabled={editLoading}
            >
              {editLoading ? t("Saving…") : t("Save")}
            </Button>
          </>
        }
      >
        <form
          id="edit-customer-type-form"
          onSubmit={editForm.handleSubmit(onEditSubmit)}
          className="flex flex-col gap-4"
        >
          <CustomerTypeFields form={editForm} idPrefix="edit-ct" />
        </form>
      </Modal>

      <Modal
        isOpen={isModalOpen}
        title={t("Add Customer Type")}
        subtitle={t("Create a new customer type for sales")}
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
              form="add-customer-type-form"
              disabled={addLoading}
            >
              {addLoading ? t("Saving…") : t("Save")}
            </Button>
          </>
        }
      >
        <form
          id="add-customer-type-form"
          onSubmit={addForm.handleSubmit(onAddSubmit)}
          className="flex flex-col gap-4"
        >
          <CustomerTypeFields form={addForm} idPrefix="add-ct" />
        </form>
      </Modal>
    </section>
  );
}

type CustomerTypeFieldsProps = {
  form: ReturnType<typeof useForm<CreateCustomerTypeFormValues>>;
  idPrefix: string;
};

function CustomerTypeFields({ form, idPrefix }: CustomerTypeFieldsProps) {
  const { t } = useI18n();
  const {
    register,
    control,
    formState: { errors },
  } = form;
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
          placeholder={t("e.g. Wholesale")}
          aria-invalid={Boolean(errors.name)}
          {...register("name")}
        />
      </FormField>
      <FormField id={`${idPrefix}-status`} label={t("Status")}>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id={`${idPrefix}-status`}>
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
    </>
  );
}
