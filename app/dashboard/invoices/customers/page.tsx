"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { useOutletAccess } from "@/app/providers/OutletAccessProvider";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import Pagination from "@/app/components/Pagination/Pagination";
import ConfirmModal from "../../../components/Modal/ConfirmModal";
import Modal from "../../../components/Modal/Modal";
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Customer | null>(null);
  const [editingItem, setEditingItem] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [outletFilter, setOutletFilter] = useState<string>("");
  const menuButtonRef = useRef<HTMLDivElement>(null);

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
    form: ReturnType<typeof useForm<CustomerFormValues>>
  ) => (
    <>
      {form.formState.errors.root?.message && (
        <p className="customersFormError">{form.formState.errors.root.message}</p>
      )}
      <label className="modalField">
        <span className="label">{t("Name")}</span>
        <input
          className="input"
          placeholder={t("Customer name")}
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <span className="customersFieldError">
            {form.formState.errors.name.message}
          </span>
        )}
      </label>
      <label className="modalField">
        <span className="label">{t("Contact")}</span>
        <input
          className="input"
          placeholder={t("Phone or email")}
          {...form.register("contact")}
        />
        {form.formState.errors.contact && (
          <span className="customersFieldError">
            {form.formState.errors.contact.message}
          </span>
        )}
      </label>
      <label className="modalField">
        <span className="label">{t("Outlet")}</span>
        <select
          className="select"
          {...form.register("outletId")}
          disabled={outletLocked}
        >
          <option value="">{t("Select outlet")}</option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        {form.formState.errors.outletId && (
          <span className="customersFieldError">
            {form.formState.errors.outletId.message}
          </span>
        )}
      </label>
      <label className="modalField">
        <span className="label">{t("Customer Type")}</span>
        <select className="select" {...form.register("customerTypeId")}>
          <option value="">{t("Select customer type")}</option>
          {customerTypes.map((ct) => (
            <option key={ct.id} value={ct.id}>
              {ct.name}
            </option>
          ))}
        </select>
        {form.formState.errors.customerTypeId && (
          <span className="customersFieldError">
            {form.formState.errors.customerTypeId.message}
          </span>
        )}
      </label>
    </>
  );

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
          <button
            type="button"
            className="button buttonPrimary"
            onClick={() => setIsModalOpen(true)}
          >
            {t("Add Customer")}
          </button>
        )}
      </div>

      <div className="customersToolbar">
        <div className="customersSearch">
          <span className="searchIcon">🔍</span>
          <input
            className="searchInput"
            placeholder={t("Search customers")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t("Search customers")}
          />
        </div>
        {isGlobal && !isScoped && (
          <select
            className="select customersOutletFilter"
            value={outletFilter}
            onChange={(e) => setOutletFilter(e.target.value)}
            aria-label={t("Filter by outlet")}
          >
            <option value="">{t("All outlets")}</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="customersTable">
        <div className="customersRow customersRowHeader">
          <span>{t("Name")}</span>
          <span>{t("Contact")}</span>
          <span>{t("Outlet")}</span>
          <span>{t("Customer Type")}</span>
          <span>{t("Created")}</span>
          <span />
        </div>
        {itemsLoading && (
          <div className="customersRow customersRowMessage">
            <span className="customersMessage">{t("Loading…")}</span>
          </div>
        )}
        {itemsError && (
          <div className="customersRow customersRowMessage">
            <span className="customersMessage customersError">
              {itemsErrorDetail instanceof Error
                ? itemsErrorDetail.message
                : t("Failed to load")}
            </span>
          </div>
        )}
        {!itemsLoading && !itemsError && items.length === 0 && (
          <div className="customersRow customersRowMessage">
            <span className="customersMessage">
              {t("No customers yet. Add one to get started.")}
            </span>
          </div>
        )}
        {!itemsLoading &&
          !itemsError &&
          items.length > 0 &&
          filteredItems.length === 0 && (
            <div className="customersRow customersRowMessage">
              <span className="customersMessage">
                {t("No items match")} &quot;{searchQuery.trim()}&quot;.
              </span>
            </div>
          )}
        {!itemsLoading &&
          !itemsError &&
          paginatedItems.map((c) => (
            <div key={c.id} className="customersRow customersRowData">
              <div className="customersRowMain">
                <span className="customersName">{c.name}</span>
                <span className="customersCellMuted">{c.contact}</span>
                <span className="customersCellMuted">
                  {outletName(outlets, c.outletId)}
                </span>
                <span className="customersCellMuted">
                  {c.customerType?.name ?? c.customerTypeId}
                </span>
                <span className="customersCellMuted">
                  {formatCreatedAt(c.createdAt)}
                </span>
              </div>
              <div
                className="customersMenuWrap"
                ref={openMenuId === c.id ? menuButtonRef : undefined}
              >
                {(canUpdate || canDelete) && (
                  <>
                    <button
                      type="button"
                      className="customersMenuTrigger"
                      onClick={() =>
                        setOpenMenuId((id) => (id === c.id ? null : c.id))
                      }
                      aria-label={t("More options")}
                      aria-expanded={openMenuId === c.id}
                    >
                      ⋮
                    </button>
                    {openMenuId === c.id && (
                      <div className="customersMenuDropdown">
                        {canUpdate && (
                          <button
                            type="button"
                            className="customersMenuItem"
                            onClick={() => {
                              setEditingItem(c);
                              setOpenMenuId(null);
                            }}
                          >
                            {t("Edit")}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="customersMenuItem customersMenuItemDanger"
                            onClick={() => {
                              setItemToDelete(c);
                              setOpenMenuId(null);
                            }}
                          >
                            {t("Delete")}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
      </div>

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
            <button
              type="button"
              className="button modalButton"
              onClick={() => setEditingItem(null)}
            >
              {t("Discard")}
            </button>
            <button
              type="submit"
              form="edit-customer-form"
              className="button buttonPrimary modalButton"
              disabled={editLoading}
            >
              {editLoading ? t("Saving…") : t("Save")}
            </button>
          </>
        }
      >
        <form
          id="edit-customer-form"
          onSubmit={editForm.handleSubmit(onEditSubmit)}
          className="customersAddForm"
        >
          {renderCustomerFormFields(editForm)}
        </form>
      </Modal>

      <Modal
        isOpen={isModalOpen}
        title={t("Add Customer")}
        subtitle={t("Create a new customer record")}
        onClose={() => setIsModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="button modalButton"
              onClick={() => setIsModalOpen(false)}
            >
              {t("Discard")}
            </button>
            <button
              type="submit"
              form="add-customer-form"
              className="button buttonPrimary modalButton"
              disabled={addLoading}
            >
              {addLoading ? t("Saving…") : t("Save")}
            </button>
          </>
        }
      >
        <form
          id="add-customer-form"
          onSubmit={addForm.handleSubmit(onAddSubmit)}
          className="customersAddForm"
        >
          {renderCustomerFormFields(addForm)}
        </form>
      </Modal>
    </section>
  );
}
