"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { usePermissions } from "@/app/providers/AuthProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import Modal from "../../../components/Modal/Modal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import { getRoles } from "@/handlers/role";
import {
  createUser as createUserApi,
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { canCreate } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
        if (result.status === 401) router.push("/login");
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
        if (result.status === 401) router.push("/login");
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

  const createMutation = useMutation({
    mutationFn: (values: CreateUserFormValues) => createUserApi(values),
    onSuccess: (result) => {
      if (result.ok) {
        setIsModalOpen(false);
        queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      } else {
        if (result.status === 401) {
          router.push("/login");
          return;
        }
        setError("root", { message: result.error });
      }
    },
    onError: () => {
      setError("root", { message: "Something went wrong. Please try again." });
    },
  });

  const onAddSubmit = (data: CreateUserFormValues) => {
    createMutation.mutate(data);
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
        <span>Settings</span> {"›"} User Management
      </div>

      <div className="usersHeader">
        <div className="usersHeaderText">
          <h1 className="pageTitle">User Management</h1>
          <p className="pageSubtitle">Manage system users and permissions</p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="button buttonPrimary"
            onClick={() => setIsModalOpen(true)}
          >
            Add User
          </button>
        )}
      </div>

      <div className="usersSearch">
        <span className="searchIcon">🔍</span>
        <input
          className="searchInput"
          placeholder="Search users"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search users"
        />
      </div>

      <div className="usersTable">
        <div className="usersRow usersRowHeader">
          <span>Employee ID</span>
          <span>Name</span>
          <span>Role</span>
          <span>Status</span>
          <span>Contact</span>
          <span />
        </div>
        {usersLoading && (
          <div className="usersRow">
            <span className="usersMessage">Loading users…</span>
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
                : "Failed to load users"}
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
            <span className="usersMessage">No users yet. Add one to get started.</span>
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
                No users match &quot;{searchQuery.trim()}&quot;.
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
                  {user.status ? "Active" : "Inactive"}
                </span>
              </span>
              <span>{user.email ?? "—"}</span>
              <span />
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
        title="Add User"
        subtitle="Quickly add a new user to your team"
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
              form="add-user-form"
              className="button buttonPrimary modalButton"
              disabled={loading}
            >
              {loading ? "Saving…" : "Save"}
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
            <span className="label">Full name</span>
            <input
              className="input"
              placeholder="e.g. John Smith"
              {...register("fullName")}
            />
            {errors.fullName && (
              <span className="usersFieldError">{errors.fullName.message}</span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              placeholder="e.g. john@example.com"
              {...register("email")}
            />
            {errors.email && (
              <span className="usersFieldError">{errors.email.message}</span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Contact</span>
            <input
              className="input"
              type="text"
              placeholder="e.g. +91 9876543210"
              {...register("contact")}
            />
            {errors.contact && (
              <span className="usersFieldError">{errors.contact.message}</span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Role</span>
            <select className="select" {...register("roleId")}>
              <option value="">Select role</option>
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
            <span className="label">Status</span>
            <select className="select" {...register("status")}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
        </form>
      </Modal>
    </section>
  );
}
