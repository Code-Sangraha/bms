"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import ConfirmModal from "../../../components/Modal/ConfirmModal";
import Modal from "../../../components/Modal/Modal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import {
  createDepartment as createDepartmentApi,
  deleteDepartment as deleteDepartmentApi,
  getDepartments,
  type Department,
  updateDepartment as updateDepartmentApi,
} from "@/handlers/department";
import {
  createDepartmentSchema,
  type CreateDepartmentFormValues,
} from "@/schema/department";
import "./departments.scss";

const DEPARTMENTS_QUERY_KEY = ["departments"];

const defaultAddFormValues: CreateDepartmentFormValues = {
  name: "",
  status: "Active",
};

function toFormValues(d: Department): CreateDepartmentFormValues {
  return {
    name: d.name,
    status: d.status ? "Active" : "Inactive",
  };
}

export default function DepartmentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { t } = useI18n();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const menuButtonRef = useRef<HTMLDivElement>(null);

  const {
    data: departments = [],
    isLoading: departmentsLoading,
    isError: departmentsError,
    error: departmentsErrorDetail,
  } = useQuery({
    queryKey: DEPARTMENTS_QUERY_KEY,
    queryFn: async () => {
      const result = await getDepartments();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const addForm = useForm<CreateDepartmentFormValues>({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: defaultAddFormValues,
  });

  const editForm = useForm<CreateDepartmentFormValues>({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: defaultAddFormValues,
  });

  useEffect(() => {
    if (!isModalOpen) addForm.reset(defaultAddFormValues);
  }, [isModalOpen, addForm.reset]);

  useEffect(() => {
    if (editingDepartment) editForm.reset(toFormValues(editingDepartment));
  }, [editingDepartment, editForm.reset]);

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
    mutationFn: (values: CreateDepartmentFormValues) =>
      createDepartmentApi({ name: values.name, status: values.status }),
    onSuccess: (result) => {
      if (result.ok) {
        setIsModalOpen(false);
        queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEY });
      } else {
        if (result.status === 401) navigate("/login");
        else addForm.setError("root", { message: result.error });
      }
    },
    onError: () => {
      addForm.setError("root", { message: t("Something went wrong. Please try again.") });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: CreateDepartmentFormValues }) =>
      updateDepartmentApi(id, values),
    onSuccess: (result, variables) => {
      if (result.ok) {
        setEditingDepartment(null);
        queryClient.setQueryData<Department[]>(DEPARTMENTS_QUERY_KEY, (old) => {
          if (!old) return old;
          return old.map((d) =>
            d.id === variables.id
              ? {
                  ...d,
                  name: variables.values.name,
                  status: variables.values.status === "Active",
                }
              : d
          );
        });
      } else {
        if (result.status === 401) navigate("/login");
        else editForm.setError("root", { message: result.error });
      }
    },
    onError: () => {
      editForm.setError("root", { message: t("Something went wrong. Please try again.") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDepartmentApi(id),
    onSuccess: (result) => {
      if (result.ok) {
        setDepartmentToDelete(null);
        queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEY });
      } else {
        if (result.status === 401) navigate("/login");
      }
    },
  });

  const onAddSubmit = (data: CreateDepartmentFormValues) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: CreateDepartmentFormValues) => {
    if (editingDepartment) {
      updateMutation.mutate({ id: editingDepartment.id, values: data });
    }
  };

  const handleConfirmDelete = () => {
    if (departmentToDelete) deleteMutation.mutate(departmentToDelete.id);
  };

  const addLoading = addForm.formState.isSubmitting || createMutation.isPending;
  const editLoading = editForm.formState.isSubmitting || updateMutation.isPending;

  const filteredDepartments = useMemo(
    () =>
      departments.filter((d) =>
        d.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ),
    [departments, searchQuery]
  );

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(filteredDepartments.length, { defaultPageSize: 10 });
  const paginatedDepartments = useMemo(
    () => paginate(filteredDepartments, startIndex, endIndex),
    [filteredDepartments, startIndex, endIndex]
  );

  return (
    <section className="departmentsPage">
      <div className="breadcrumb">
        <span>{t("Settings")}</span> {"›"} {t("Department")}
      </div>

      <div className="departmentsHeader">
        <div className="departmentsHeaderText">
          <h1 className="pageTitle">{t("Department")}</h1>
          <p className="pageSubtitle">
            {t("Organize your team by departments for clarity")}
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="button buttonPrimary"
            onClick={() => setIsModalOpen(true)}
          >
            {t("Add Department")}
          </button>
        )}
      </div>

      <div className="departmentsSearch">
        <span className="searchIcon">🔍</span>
        <input
          className="searchInput"
          placeholder={t("Search departments")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t("Search departments")}
        />
      </div>

      <div className="departmentsTable">
        <div className="departmentsRow departmentsRowHeader">
          <span>{t("Department")}</span>
          <span>{t("Status")}</span>
          <span />
        </div>
        {departmentsLoading && (
          <div className="departmentsRow">
            <span className="departmentsMessage">{t("Loading departments…")}</span>
            <span />
            <span />
          </div>
        )}
        {departmentsError && (
          <div className="departmentsRow">
            <span className="departmentsMessage departmentsError">
              {departmentsErrorDetail instanceof Error
                ? departmentsErrorDetail.message
                : t("Failed to load departments")}
            </span>
            <span />
            <span />
          </div>
        )}
        {!departmentsLoading &&
          !departmentsError &&
          departments.length === 0 && (
            <div className="departmentsRow">
              <span className="departmentsMessage">
                {t("No departments yet. Add one to get started.")}
              </span>
              <span />
              <span />
            </div>
          )}
        {!departmentsLoading &&
          !departmentsError &&
          departments.length > 0 &&
          filteredDepartments.length === 0 && (
            <div className="departmentsRow">
              <span className="departmentsMessage">
                {t("No departments match")} &quot;{searchQuery.trim()}&quot;.
              </span>
              <span />
              <span />
            </div>
          )}
        {!departmentsLoading &&
          !departmentsError &&
          paginatedDepartments.map((department) => (
            <div key={department.id} className="departmentsRow">
              <span>{department.name}</span>
              <span>
                <span
                  className={
                    department.status ? "badge badgeActive" : "badge"
                  }
                >
                  {department.status ? t("Active") : t("Inactive")}
                </span>
              </span>
              <div
                className="departmentsMenuWrap"
                ref={openMenuId === department.id ? menuButtonRef : undefined}
              >
                {(canUpdate || canDelete) && (
                  <>
                    <button
                      type="button"
                      className="departmentsMenuTrigger"
                      onClick={() =>
                        setOpenMenuId((id) =>
                          id === department.id ? null : department.id
                        )
                      }
                      aria-label={t("More options")}
                      aria-expanded={openMenuId === department.id}
                    >
                      ⋮
                    </button>
                    {openMenuId === department.id && (
                      <div className="departmentsMenuDropdown">
                        {canUpdate && (
                          <button
                            type="button"
                            className="departmentsMenuItem"
                            onClick={() => {
                              setEditingDepartment(department);
                              setOpenMenuId(null);
                            }}
                          >
                            {t("Edit")}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="departmentsMenuItem departmentsMenuItemDanger"
                            onClick={() => {
                              setDepartmentToDelete(department);
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

      {!departmentsLoading && !departmentsError && filteredDepartments.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredDepartments.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          pageSizeOptions={[10, 20, 50]}
          onPageSizeChange={setPageSize}
        />
      )}

      <ConfirmModal
        isOpen={!!departmentToDelete}
        title={t("Delete department")}
        message={
          departmentToDelete
            ? `${t("Are you sure you want to delete")} "${departmentToDelete.name}"? ${t("This action cannot be undone.")}`
            : ""
        }
        confirmLabel={t("Delete")}
        cancelLabel={t("Cancel")}
        variant="danger"
        loading={deleteMutation.isPending}
        onClose={() => setDepartmentToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      <Modal
        isOpen={!!editingDepartment}
        title={t("Edit Department")}
        subtitle={editingDepartment?.name}
        onClose={() => setEditingDepartment(null)}
        footer={
          <>
            <button
              type="button"
              className="button modalButton"
              onClick={() => setEditingDepartment(null)}
            >
              {t("Discard")}
            </button>
            <button
              type="submit"
              form="edit-department-form"
              className="button buttonPrimary modalButton"
              disabled={editLoading}
            >
              {editLoading ? t("Saving…") : t("Save")}
            </button>
          </>
        }
      >
        <form
          id="edit-department-form"
          onSubmit={editForm.handleSubmit(onEditSubmit)}
          className="departmentsAddForm"
        >
          {editForm.formState.errors.root?.message && (
            <p className="departmentsFormError">
              {editForm.formState.errors.root.message}
            </p>
          )}
          <label className="modalField">
            <span className="label">{t("Department name")}</span>
            <input
              className="input"
              placeholder={t("e.g. Production")}
              {...editForm.register("name")}
            />
            {editForm.formState.errors.name && (
              <span className="departmentsFieldError">
                {editForm.formState.errors.name.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">{t("Status")}</span>
            <select className="select" {...editForm.register("status")}>
              <option value="Active">{t("Active")}</option>
              <option value="Inactive">{t("Inactive")}</option>
            </select>
          </label>
        </form>
      </Modal>

      <Modal
        isOpen={isModalOpen}
        title={t("Add Department")}
        subtitle={t("Quickly add a new department")}
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
              form="add-department-form"
              className="button buttonPrimary modalButton"
              disabled={addLoading}
            >
              {addLoading ? t("Saving…") : t("Save")}
            </button>
          </>
        }
      >
        <form
          id="add-department-form"
          onSubmit={addForm.handleSubmit(onAddSubmit)}
          className="departmentsAddForm"
        >
          {addForm.formState.errors.root?.message && (
            <p className="departmentsFormError">
              {addForm.formState.errors.root.message}
            </p>
          )}
          <label className="modalField">
            <span className="label">{t("Department name")}</span>
            <input
              className="input"
              placeholder={t("e.g. Production")}
              {...addForm.register("name")}
            />
            {addForm.formState.errors.name && (
              <span className="departmentsFieldError">
                {addForm.formState.errors.name.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">{t("Status")}</span>
            <select className="select" {...addForm.register("status")}>
              <option value="Active">{t("Active")}</option>
              <option value="Inactive">{t("Inactive")}</option>
            </select>
          </label>
        </form>
      </Modal>
    </section>
  );
}

