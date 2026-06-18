"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useMemo, useState, type FormEvent, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import ConfirmModal from "../../components/Modal/ConfirmModal";
import Modal from "../../components/Modal/Modal";
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
import { FormField } from "@/app/components/ui-ext/FormField";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import { ErrorState } from "@/app/components/ui-ext/ErrorState";
import { TableSkeleton } from "@/app/components/ui-ext/LoadingState";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import { getOutlets } from "@/handlers/outlet";
import { getRoles } from "@/handlers/role";
import {
  createUser as createUserApi,
  deleteUser as deleteUserApi,
  getUsers,
  updateUser as updateUserApi,
  type User,
} from "@/handlers/user";
import { createUserSchema, type CreateUserFormValues } from "@/schema/user";
import "./users.scss";

const USERS_QUERY_KEY = ["users"];
const ROLES_QUERY_KEY = ["roles"];
const OUTLETS_QUERY_KEY = ["outlets"];

const defaultFormValues: CreateUserFormValues = {
  fullName: "",
  email: "",
  roleId: "",
  status: "Active",
  contact: "",
  outletId: "",
};


export default function UsersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canCreate } = usePermissions();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editModalUser, setEditModalUser] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editRoleId, setEditRoleId] = useState("");
  const [editOutletId, setEditOutletId] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

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
    control,
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
        queryClient.invalidateQueries({ queryKey: ["employees"] });
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
        setUserToDelete(null);
        queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      } else if (result.status === 401) {
        setUserToDelete(null);
        navigate("/login");
      } else {
        setDeleteError(result.error ?? t("Failed to delete user"));
        setUserToDelete(null);
      }
    },
    onError: () => {
      setDeleteError(t("Something went wrong. Please try again."));
      setUserToDelete(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      fullName: string;
      email: string;
      roleId: string;
      status: boolean;
      contact?: string;
      outletId: string | null;
    }) =>
      updateUserApi({
        id: payload.id,
        fullName: payload.fullName,
        email: payload.email,
        roleId: payload.roleId,
        status: payload.status,
        contact: payload.contact,
        outletId: payload.outletId,
      }),
    onSuccess: (result) => {
      if (result.ok) {
        setEditError(null);
        setEditModalUser(null);
        queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: ["employees"] });
        showToast(
          t(
            "User updated. They may need to sign in again for role or outlet changes to apply to their session."
          )
        );
      } else if (result.status === 401) {
        navigate("/login");
      } else {
        setEditError(result.error ?? t("Failed to update user"));
      }
    },
    onError: () => {
      setEditError(t("Something went wrong. Please try again."));
    },
  });

  const onAddSubmit = (data: CreateUserFormValues) => {
    createMutation.mutate(data);
  };

  const handleOpenEdit = (user: User) => {
    setEditError(null);
    setEditModalUser(user);
    setEditFullName(typeof user.fullName === "string" ? user.fullName : "");
    setEditEmail(typeof user.email === "string" ? user.email : "");
    setEditContact(typeof user.contact === "string" ? user.contact : "");
    setEditRoleId(typeof user.roleId === "string" ? user.roleId : "");
    const oid = user.outletId;
    setEditOutletId(
      typeof oid === "string" && oid.trim() !== "" ? oid.trim() : ""
    );
  };

  const handleEditSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!editModalUser) return;
    const fullName = editFullName.trim();
    const email = editEmail.trim().toLowerCase();
    const roleId = editRoleId.trim();
    if (!fullName || !email || !roleId) {
      setEditError(t("Please fill all required fields"));
      return;
    }
    updateMutation.mutate({
      id: editModalUser.id,
      fullName,
      email,
      roleId,
      status: editModalUser.status,
      contact: editContact.trim() || undefined,
      outletId: editOutletId.trim() === "" ? null : editOutletId.trim(),
    });
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
  };

  const handleConfirmDeleteUser = () => {
    if (!userToDelete) return;
    deleteMutation.mutate(userToDelete.id);
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
        <span>{t("Dashboard")}</span> {"›"} {t("User Management")}
      </div>

      <div className="usersHeader">
        <div className="usersHeaderText">
          <h1 className="pageTitle">{t("User Management")}</h1>
          <p className="pageSubtitle">{t("Manage system users and permissions")}</p>
        </div>
        {canCreate && (
          <Button type="button" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t("Add User")}
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
          placeholder={t("Search users")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t("Search users")}
          className="pl-8"
        />
      </div>
      {deleteError && (
        <Alert variant="destructive">
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}

      {usersLoading && <TableSkeleton rows={6} columns={4} />}
      {usersError && (
        <ErrorState
          title={t("Failed to load users")}
          description={
            usersErrorDetail instanceof Error
              ? usersErrorDetail.message
              : undefined
          }
        />
      )}
      {!usersLoading && !usersError && users.length === 0 && (
        <EmptyState
          title={t("No users yet. Add one to get started.")}
          action={
            canCreate ? (
              <Button type="button" onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                {t("Add User")}
              </Button>
            ) : undefined
          }
        />
      )}
      {!usersLoading &&
        !usersError &&
        users.length > 0 &&
        filteredUsers.length === 0 && (
          <EmptyState title={`${t("No users match")} "${searchQuery.trim()}"`} />
        )}
      {!usersLoading && !usersError && filteredUsers.length > 0 && (
        <div className="usersTable">
          <div className="usersRow usersRowHeader">
            <span>{t("Employee ID")}</span>
            <span>{t("Name")}</span>
            <span>{t("Role")}</span>
            <span>{t("Contact")}</span>
          </div>
          {paginatedUsers.map((user) => (
            <div key={user.id} className="usersRow usersRowData">
              <span className="usersCellId">{user.id}</span>
              <span className="usersCellName" data-field-label={t("Name")}>
                {user.fullName ?? "—"}
              </span>
              <div className="usersRoleActions">
                <div>
                  <span className="usersRoleLabelMobile">{t("Role")}</span>
                  <span className="usersRoleValue">{getRoleName(user)}</span>
                </div>
                <span className="usersActionsCell">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("Open actions")}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => handleOpenEdit(user)}>
                        {t("Edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => handleDeleteUser(user)}
                        disabled={deleteMutation.isPending}
                        className="text-destructive focus:text-destructive"
                      >
                        {deleteMutation.isPending ? t("Deleting…") : t("Delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </span>
              </div>
              <span className="usersCellContact" data-field-label={t("Contact")}>
                {user.contact ?? user.email ?? "—"}
              </span>
            </div>
          ))}
        </div>
      )}

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
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              {t("Discard")}
            </Button>
            <Button type="submit" form="add-user-form" disabled={loading}>
              {loading ? t("Saving…") : t("Save")}
            </Button>
          </>
        }
      >
        <form
          id="add-user-form"
          onSubmit={handleSubmit(onAddSubmit)}
          className="space-y-4"
        >
          {errors.root?.message && (
            <Alert variant="destructive">
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}
          <FormField label={t("Full name")} error={errors.fullName?.message}>
            <Input placeholder={t("e.g. John Smith")} {...register("fullName")} />
          </FormField>
          <FormField label={t("Email")} error={errors.email?.message}>
            <Input
              type="email"
              placeholder={t("e.g. john@example.com")}
              {...register("email")}
            />
          </FormField>
          <FormField label={t("Contact")} error={errors.contact?.message}>
            <Input
              type="text"
              placeholder={t("e.g. +91 9876543210")}
              {...register("contact")}
            />
          </FormField>
          <FormField label={t("Role")} error={errors.roleId?.message}>
            <Controller
              control={control}
              name="roleId"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select role")} />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label={t("Outlet")} error={errors.outletId?.message}>
            <Controller
              control={control}
              name="outletId"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("No outlet")} />
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
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!userToDelete}
        title={t("Delete user")}
        message={
          userToDelete
            ? `${t("Are you sure you want to delete")} "${userToDelete.fullName?.trim() || userToDelete.email?.trim() || userToDelete.id}"? ${t("This action cannot be undone.")}`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleteMutation.isPending}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleConfirmDeleteUser}
      />

      <Modal
        isOpen={!!editModalUser}
        title={t("Edit User")}
        subtitle={t("Update user details")}
        onClose={() => setEditModalUser(null)}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditModalUser(null)}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              form="edit-user-form"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? t("Saving…") : t("Update")}
            </Button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={handleEditSubmit} className="space-y-4">
          {editError && (
            <Alert variant="destructive">
              <AlertDescription>{editError}</AlertDescription>
            </Alert>
          )}
          <FormField label={t("Full name")}>
            <Input
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              placeholder={t("e.g. John Smith")}
            />
          </FormField>
          <FormField label={t("Email")}>
            <Input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder={t("e.g. john@example.com")}
            />
          </FormField>
          <FormField label={t("Contact")}>
            <Input
              type="text"
              value={editContact}
              onChange={(e) => setEditContact(e.target.value)}
              placeholder={t("e.g. +91 9876543210")}
            />
          </FormField>
          <FormField label={t("Role")}>
            <Select value={editRoleId || undefined} onValueChange={setEditRoleId}>
              <SelectTrigger>
                <SelectValue placeholder={t("Select role")} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t("Outlet")}>
            <Select value={editOutletId || undefined} onValueChange={setEditOutletId}>
              <SelectTrigger>
                <SelectValue placeholder={t("No outlet")} />
              </SelectTrigger>
              <SelectContent>
                {outlets.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </form>
      </Modal>
    </section>
  );
}
