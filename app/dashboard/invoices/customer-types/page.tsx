"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { usePermissions } from "@/app/providers/AuthProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import ConfirmModal from "../../../components/Modal/ConfirmModal";
import Modal from "../../../components/Modal/Modal";
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<CustomerType | null>(null);
  const [editingItem, setEditingItem] = useState<CustomerType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const menuButtonRef = useRef<HTMLDivElement>(null);

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
        if (result.status === 401) router.push("/login");
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
    mutationFn: (values: CreateCustomerTypeFormValues) =>
      createCustomerTypeApi(values),
    onSuccess: (result) => {
      if (result.ok) {
        setIsModalOpen(false);
        queryClient.invalidateQueries({ queryKey: CUSTOMER_TYPES_QUERY_KEY });
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
      values: CreateCustomerTypeFormValues;
    }) => updateCustomerTypeApi(id, values),
    onSuccess: (result) => {
      if (result.ok) {
        setEditingItem(null);
        queryClient.invalidateQueries({ queryKey: CUSTOMER_TYPES_QUERY_KEY });
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
    mutationFn: (id: string) => deleteCustomerTypeApi(id),
    onSuccess: (result) => {
      if (result.ok) {
        setItemToDelete(null);
        queryClient.invalidateQueries({ queryKey: CUSTOMER_TYPES_QUERY_KEY });
      } else {
        if (result.status === 401) router.push("/login");
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
        <span>Sales & Billing</span> {"›"} Customer Types
      </div>

      <div className="customerTypesHeader">
        <div className="customerTypesHeaderText">
          <h1 className="pageTitle">Customer Types</h1>
          <p className="pageSubtitle">
            Manage customer types for retail and wholesale
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="button buttonPrimary"
            onClick={() => setIsModalOpen(true)}
          >
            Add Customer Type
          </button>
        )}
      </div>

      <div className="customerTypesSearch">
        <span className="searchIcon">🔍</span>
        <input
          className="searchInput"
          placeholder="Search customer types"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search customer types"
        />
      </div>

      <div className="customerTypesTable">
        <div className="customerTypesRow customerTypesRowHeader">
          <span>Name</span>
          <span>Status</span>
          <span />
        </div>
        {itemsLoading && (
          <div className="customerTypesRow">
            <span className="customerTypesMessage">Loading…</span>
            <span />
            <span />
          </div>
        )}
        {itemsError && (
          <div className="customerTypesRow">
            <span className="customerTypesMessage customerTypesError">
              {itemsErrorDetail instanceof Error
                ? itemsErrorDetail.message
                : "Failed to load"}
            </span>
            <span />
            <span />
          </div>
        )}
        {!itemsLoading && !itemsError && items.length === 0 && (
          <div className="customerTypesRow">
            <span className="customerTypesMessage">
              No customer types yet. Add one to get started.
            </span>
            <span />
            <span />
          </div>
        )}
        {!itemsLoading &&
          !itemsError &&
          items.length > 0 &&
          filteredItems.length === 0 && (
            <div className="customerTypesRow">
              <span className="customerTypesMessage">
                No items match &quot;{searchQuery.trim()}&quot;.
              </span>
              <span />
              <span />
            </div>
          )}
        {!itemsLoading &&
          !itemsError &&
          paginatedItems.map((ct) => (
            <div key={ct.id} className="customerTypesRow">
              <span>{ct.name}</span>
              <span>
                <span
                  className={ct.status ? "badge badgeActive" : "badge"}
                >
                  {ct.status ? "Active" : "Inactive"}
                </span>
              </span>
              <div
                className="customerTypesMenuWrap"
                ref={openMenuId === ct.id ? menuButtonRef : undefined}
              >
                {(canUpdate || canDelete) && (
                  <>
                    <button
                      type="button"
                      className="customerTypesMenuTrigger"
                      onClick={() =>
                        setOpenMenuId((id) => (id === ct.id ? null : ct.id))
                      }
                      aria-label="More options"
                      aria-expanded={openMenuId === ct.id}
                    >
                      ⋮
                    </button>
                    {openMenuId === ct.id && (
                      <div className="customerTypesMenuDropdown">
                        {canUpdate && (
                          <button
                            type="button"
                            className="customerTypesMenuItem"
                            onClick={() => {
                              setEditingItem(ct);
                              setOpenMenuId(null);
                            }}
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="customerTypesMenuItem customerTypesMenuItemDanger"
                            onClick={() => {
                              setItemToDelete(ct);
                              setOpenMenuId(null);
                            }}
                          >
                            Delete
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
        title="Delete customer type"
        message={
          itemToDelete
            ? `Are you sure you want to delete "${itemToDelete.name}"? This action cannot be undone.`
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
        title="Edit Customer Type"
        subtitle={editingItem?.name}
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
              form="edit-customer-type-form"
              className="button buttonPrimary modalButton"
              disabled={editLoading}
            >
              {editLoading ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form
          id="edit-customer-type-form"
          onSubmit={editForm.handleSubmit(onEditSubmit)}
          className="customerTypesAddForm"
        >
          {editForm.formState.errors.root?.message && (
            <p className="customerTypesFormError">
              {editForm.formState.errors.root.message}
            </p>
          )}
          <label className="modalField">
            <span className="label">Name</span>
            <input
              className="input"
              placeholder="e.g. Wholesale"
              {...editForm.register("name")}
            />
            {editForm.formState.errors.name && (
              <span className="customerTypesFieldError">
                {editForm.formState.errors.name.message}
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
        title="Add Customer Type"
        subtitle="Create a new customer type for sales"
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
              form="add-customer-type-form"
              className="button buttonPrimary modalButton"
              disabled={addLoading}
            >
              {addLoading ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form
          id="add-customer-type-form"
          onSubmit={addForm.handleSubmit(onAddSubmit)}
          className="customerTypesAddForm"
        >
          {addForm.formState.errors.root?.message && (
            <p className="customerTypesFormError">
              {addForm.formState.errors.root.message}
            </p>
          )}
          <label className="modalField">
            <span className="label">Name</span>
            <input
              className="input"
              placeholder="e.g. Wholesale"
              {...addForm.register("name")}
            />
            {addForm.formState.errors.name && (
              <span className="customerTypesFieldError">
                {addForm.formState.errors.name.message}
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
