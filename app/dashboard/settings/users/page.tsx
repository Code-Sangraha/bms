"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import Modal from "../../../components/Modal/Modal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import { getRoles } from "@/handlers/role";
import {
  createUser as createUserApi,
  deleteUser as deleteUserApi,
  getUsers,
  type User,
} from "@/handlers/user";
import { createUserSchema, type CreateUserFormValues } from "@/schema/user";
import "./users.scss";

const USERS_QUERY_KEY = ["users"];
const ROLES_QUERY_KEY = ["roles"];

const defaultFormValues: CreateUserFormValues = {
  fullName: "",
  email: "",
  roleId: "",
  status: "Active",
  contact: "",
};


export default function UsersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canCreate } = usePermissions();
  const { t } = useI18n();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openActionUserId, setOpenActionUserId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    data: users = [],
    isLoading: usersLoading,
    isError: usersError,
    error: usersErrorDetail,
  } = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: async () => {
      const result = await getUsers();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ROLES_QUERY_KEY,
    queryFn: async () => {
      const result = await getRoles();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: defaultFormValues,
  });

  useEffect(() => {
    if (!isModalOpen) reset(defaultFormValues);
  }, [isModalOpen, reset]);

  useEffect(() => {
    const handleWindowClick = () => setOpenActionUserId(null);
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  const createMutation = useMutation({
    mutationFn: (values: CreateUserFormValues) => createUserApi(values),
    onSuccess: (result) => {
      if (result.ok) {
        setIsModalOpen(false);
        queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      } else {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        setError("root", { message: result.error });
      }
    },
    onError: () => {
      setError("root", { message: t("Something went wrong. Please try again.") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUserApi(id),
    onSuccess: (result) => {
      if (result.ok) {
        setDeleteError(null);
        setOpenActionUserId(null);
        queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      } else if (result.status === 401) {
        navigate("/login");
      } else {
        setDeleteError(result.error ?? t("Failed to delete user"));
      }
    },
    onError: () => {
      setDeleteError(t("Something went wrong. Please try again."));
    },
  });

  const onAddSubmit = (data: CreateUserFormValues) => {
    createMutation.mutate(data);
  };

  const handleDeleteUser = (user: User) => {
    const label = user.fullName?.trim() || user.email?.trim() || user.id;
    const confirmed = window.confirm(`${t("Delete user")} "${label}"?`);
    if (!confirmed) return;
    deleteMutation.mutate(user.id);
  };

  const loading = isSubmitting || createMutation.isPending;

  const getRoleName = (user: User): string => {
    const r = user.role;
    if (r != null) {
      if (typeof r === "string") return r;
      if (typeof r === "object" && "name" in r && typeof r.name === "string")
        return r.name;
    }
    const role = roles.find((r) => r.id === user.roleId);
    return role?.name ?? user.roleId ?? "—";
  };

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.fullName?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          u.email?.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ),
    [users, searchQuery]
  );

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(filteredUsers.length, { defaultPageSize: 10 });
  const paginatedUsers = useMemo(
    () => paginate(filteredUsers, startIndex, endIndex),
    [filteredUsers, startIndex, endIndex]
  );

  return (
    <section className="usersPage">
      <div className="breadcrumb">
        <span>{t("Settings")}</span> {"›"} {t("User Management")}
      </div>

      <div className="usersHeader">
        <div className="usersHeaderText">
          <h1 className="pageTitle">{t("User Management")}</h1>
          <p className="pageSubtitle">{t("Manage system users and permissions")}</p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="button buttonPrimary"
            onClick={() => setIsModalOpen(true)}
          >
            {t("Add User")}
          </button>
        )}
      </div>

      <div className="usersSearch">
        <span className="searchIcon">🔍</span>
        <input
          className="searchInput"
          placeholder={t("Search users")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t("Search users")}
        />
      </div>
      {deleteError && <p className="usersDeleteError">{deleteError}</p>}

      <div className="usersTable">
        <div className="usersRow usersRowHeader">
          <span>{t("Employee ID")}</span>
          <span>{t("Name")}</span>
          <span>{t("Role")}</span>
          <span>{t("Status")}</span>
          <span>{t("Contact")}</span>
          <span />
        </div>
        {usersLoading && (
          <div className="usersRow">
            <span className="usersMessage">{t("Loading users…")}</span>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {usersError && (
          <div className="usersRow">
            <span className="usersMessage usersError">
              {usersErrorDetail instanceof Error
                ? usersErrorDetail.message
                : t("Failed to load users")}
            </span>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {!usersLoading && !usersError && users.length === 0 && (
          <div className="usersRow">
            <span className="usersMessage">{t("No users yet. Add one to get started.")}</span>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {!usersLoading &&
          !usersError &&
          users.length > 0 &&
          filteredUsers.length === 0 && (
            <div className="usersRow">
              <span className="usersMessage">
                {t("No users match")} &quot;{searchQuery.trim()}&quot;.
              </span>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
        {!usersLoading &&
          !usersError &&
          paginatedUsers.map((user) => (
            <div key={user.id} className="usersRow">
              <span>{user.id}</span>
              <span>{user.fullName ?? "—"}</span>
              <span>{getRoleName(user)}</span>
              <span>
                <span
                  className={user.status ? "badge badgeActive" : "badge"}
                >
                  {user.status ? t("Active") : t("Inactive")}
                </span>
              </span>
              <span>{user.email ?? "—"}</span>
              <span className="usersActionsCell">
                <button
                  type="button"
                  className="moreButton"
                  aria-label={t("Open actions")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenActionUserId((prev) => (prev === user.id ? null : user.id));
                  }}
                >
                  ⋮
                </button>
                {openActionUserId === user.id && (
                  <div
                    className="usersActionsMenu"
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="usersActionItem usersActionDelete"
                      onClick={() => handleDeleteUser(user)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? t("Deleting…") : t("Delete")}
                    </button>
                  </div>
                )}
              </span>
            </div>
          ))}
      </div>

      {!usersLoading && !usersError && filteredUsers.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredUsers.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          pageSizeOptions={[10, 20, 50]}
          onPageSizeChange={setPageSize}
        />
      )}

      <Modal
        isOpen={isModalOpen}
        title={t("Add User")}
        subtitle={t("Quickly add a new user to your team")}
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
              form="add-user-form"
              className="button buttonPrimary modalButton"
              disabled={loading}
            >
              {loading ? t("Saving…") : t("Save")}
            </button>
          </>
        }
      >
        <form
          id="add-user-form"
          onSubmit={handleSubmit(onAddSubmit)}
          className="usersAddForm"
        >
          {errors.root?.message && (
            <p className="usersFormError" role="alert">
              {errors.root.message}
            </p>
          )}
          <label className="modalField">
            <span className="label">{t("Full name")}</span>
            <input
              className="input"
              placeholder={t("e.g. John Smith")}
              {...register("fullName")}
            />
            {errors.fullName && (
              <span className="usersFieldError">{errors.fullName.message}</span>
            )}
          </label>
          <label className="modalField">
            <span className="label">{t("Email")}</span>
            <input
              className="input"
              type="email"
              placeholder={t("e.g. john@example.com")}
              {...register("email")}
            />
            {errors.email && (
              <span className="usersFieldError">{errors.email.message}</span>
            )}
          </label>
          <label className="modalField">
            <span className="label">{t("Contact")}</span>
            <input
              className="input"
              type="text"
              placeholder={t("e.g. +91 9876543210")}
              {...register("contact")}
            />
            {errors.contact && (
              <span className="usersFieldError">{errors.contact.message}</span>
            )}
          </label>
          <label className="modalField">
            <span className="label">{t("Role")}</span>
            <select className="select" {...register("roleId")}>
              <option value="">{t("Select role")}</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {errors.roleId && (
              <span className="usersFieldError">{errors.roleId.message}</span>
            )}
          </label>
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
