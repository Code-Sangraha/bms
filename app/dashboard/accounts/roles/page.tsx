"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import ConfirmModal from "../../../components/Modal/ConfirmModal";
import Modal from "../../../components/Modal/Modal";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Checkbox } from "@/app/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
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
import { clearAuthToken } from "@/lib/auth/token";
import { clearStoredUser } from "@/lib/auth/user";
import {
  deleteRole as deleteRoleApi,
  getPermissions as getRolePermissions,
  getRoles,
  type RolePermission,
  type Role,
  updateRole as updateRoleApi,
  updateRolePermissions,
} from "@/handlers/role";
import { createRoleSchema, type CreateRoleFormValues } from "@/schema/role";
import "./roles.scss";

const defaultFormValues: CreateRoleFormValues = {
  name: "",
};

function toFormValues(r: Role): CreateRoleFormValues {
  return { name: r.name };
}

const ROLES_QUERY_KEY = ["roles"];
const ROLE_PERMISSIONS_QUERY_KEY = ["role-permissions"];

function getPermissionGroupName(permissionName: string): string {
  const [group] = permissionName.split(":");
  return group?.trim() || "other";
}

function getPermissionIdsFromRole(role: Role | null): string[] {
  if (!role) return [];
  if (Array.isArray(role.permissionIds)) {
    return role.permissionIds.filter((id): id is string => typeof id === "string");
  }
  if (Array.isArray(role.permissions)) {
    return role.permissions
      .map((permission) => permission.id)
      .filter((id): id is string => typeof id === "string");
  }
  return [];
}

function getDeleteErrorMessage(error: string, t: (text: string) => string) {
  if (/foreign key|constraint|reference|referenced|in use/i.test(error)) {
    return t("This role is assigned to users or employees and cannot be deleted.");
  }
  return error;
}

export default function RolesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [permissionRole, setPermissionRole] = useState<Role | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: roles = [],
    isLoading: rolesLoading,
    isError: rolesError,
    error: rolesErrorDetail,
  } = useQuery({
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

  const editForm = useForm<CreateRoleFormValues>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: defaultFormValues,
  });

  useEffect(() => {
    if (editingRole) editForm.reset(toFormValues(editingRole));
  }, [editingRole, editForm]);

  useEffect(() => {
    if (!roleToDelete) setDeleteError(null);
  }, [roleToDelete]);

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: CreateRoleFormValues }) =>
      updateRoleApi(id, values),
    onSuccess: (result, variables) => {
      if (result.ok) {
        setEditingRole(null);
        queryClient.setQueryData<Role[]>(ROLES_QUERY_KEY, (old) => {
          if (!old) return old;
          return old.map((r) =>
            r.id === variables.id
              ? { ...r, name: variables.values.name }
              : r
          );
        });
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
    mutationFn: (id: string) => deleteRoleApi(id),
    onSuccess: (result) => {
      if (result.ok) {
        setRoleToDelete(null);
        setDeleteError(null);
        queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
      } else {
        if (result.status === 401) navigate("/login");
        else setDeleteError(getDeleteErrorMessage(result.error, t));
      }
    },
    onError: () => {
      setDeleteError(t("Something went wrong. Please try again."));
    },
  });

  const {
    data: allPermissions = [],
    isLoading: permissionsLoading,
    isError: permissionsIsError,
    error: permissionsErrorDetail,
  } = useQuery({
    queryKey: ROLE_PERMISSIONS_QUERY_KEY,
    enabled: permissionRole != null,
    queryFn: async () => {
      const result = await getRolePermissions();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: () => {
      if (!permissionRole) {
        throw new Error(t("No role selected."));
      }
      return updateRolePermissions({
        roleId: permissionRole.id,
        permissionIds: selectedPermissionIds,
      });
    },
    onSuccess: (result) => {
      if (result.ok) {
        setPermissionError(null);
        setPermissionRole(null);
        showToast(
          t("Permissions updated. Please sign in again to refresh access."),
          "info"
        );
        window.setTimeout(() => {
          clearAuthToken();
          clearStoredUser();
          navigate("/login", { replace: true });
        }, 1200);
      } else {
        if (result.status === 401) navigate("/login");
        else setPermissionError(result.error);
      }
    },
    onError: () => {
      setPermissionError(t("Something went wrong. Please try again."));
    },
  });

  const onEditSubmit = (data: CreateRoleFormValues) => {
    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, values: data });
    }
  };

  const handleConfirmDelete = () => {
    setDeleteError(null);
    if (roleToDelete) deleteMutation.mutate(roleToDelete.id);
  };

  const openPermissionModal = (role: Role) => {
    setPermissionRole(role);
    setPermissionError(null);
    setSelectedPermissionIds(getPermissionIdsFromRole(role));
  };

  const closePermissionModal = () => {
    if (updatePermissionsMutation.isPending) return;
    setPermissionRole(null);
    setPermissionError(null);
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissionIds((current) =>
      current.includes(permissionId)
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId]
    );
  };

  const editLoading =
    editForm.formState.isSubmitting || updateMutation.isPending;

  const filteredRoles = useMemo(
    () =>
      roles.filter((r) =>
        r.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ),
    [roles, searchQuery]
  );

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(filteredRoles.length, { defaultPageSize: 10 });
  const paginatedRoles = useMemo(
    () => paginate(filteredRoles, startIndex, endIndex),
    [filteredRoles, startIndex, endIndex]
  );

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, RolePermission[]>();
    for (const permission of allPermissions) {
      const groupName = getPermissionGroupName(permission.name);
      const groupPermissions = groups.get(groupName) ?? [];
      groupPermissions.push(permission);
      groups.set(groupName, groupPermissions);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, permissions]) => ({
        name,
        permissions: [...permissions].sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [allPermissions]);

  return (
    <section className="rolesPage">
      <div className="breadcrumb">
        <span>{t("Dashboard")}</span> {"›"} {t("Roles")}
      </div>

      <div className="rolesHeader">
        <div className="rolesHeaderText">
          <h1 className="pageTitle">{t("Roles")}</h1>
          <p className="pageSubtitle">
            {t("Manage roles and permissions for your team")}
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link to="/dashboard/accounts/roles/create">
              <Plus className="h-4 w-4" aria-hidden />
              {t("Create role")}
            </Link>
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
          placeholder={t("Search roles")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t("Search roles")}
          className="pl-8"
        />
      </div>

      {rolesLoading && <TableSkeleton rows={6} columns={2} />}
      {rolesError && (
        <ErrorState
          title={t("Failed to load roles")}
          description={
            rolesErrorDetail instanceof Error
              ? rolesErrorDetail.message
              : undefined
          }
        />
      )}
      {!rolesLoading && !rolesError && roles.length === 0 && (
        <EmptyState
          title={t("No roles yet. Create one to get started.")}
          action={
            canCreate ? (
              <Button asChild>
                <Link to="/dashboard/accounts/roles/create">
                  <Plus className="h-4 w-4" aria-hidden />
                  {t("Create role")}
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}
      {!rolesLoading &&
        !rolesError &&
        roles.length > 0 &&
        filteredRoles.length === 0 && (
          <EmptyState title={`${t("No roles match")} "${searchQuery.trim()}"`} />
        )}
      {!rolesLoading && !rolesError && filteredRoles.length > 0 && (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Role")}</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRoles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell>
                    {(canUpdate || canDelete) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t("More options")}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canUpdate && (
                            <>
                              <DropdownMenuItem onSelect={() => setEditingRole(role)}>
                                {t("Edit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => openPermissionModal(role)}
                              >
                                {t("Manage permissions")}
                              </DropdownMenuItem>
                            </>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              onSelect={() => setRoleToDelete(role)}
                              className="text-destructive focus:text-destructive"
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

      {!rolesLoading && !rolesError && filteredRoles.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredRoles.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          pageSizeOptions={[10, 20, 50]}
          onPageSizeChange={setPageSize}
        />
      )}

      <ConfirmModal
        isOpen={!!roleToDelete}
        title={t("Delete role")}
        message={
          roleToDelete
            ? `${t("Are you sure you want to delete")} "${roleToDelete.name}"? ${t(
                "This action cannot be undone."
              )}${deleteError ? ` ${deleteError}` : ""}`
            : ""
        }
        confirmLabel={t("Delete")}
        cancelLabel={t("Cancel")}
        variant="danger"
        loading={deleteMutation.isPending}
        onClose={() => setRoleToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      <Modal
        isOpen={!!editingRole}
        title={t("Edit Role")}
        subtitle={editingRole?.name}
        onClose={() => setEditingRole(null)}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingRole(null)}
            >
              {t("Discard")}
            </Button>
            <Button type="submit" form="edit-role-form" disabled={editLoading}>
              {editLoading ? t("Saving…") : t("Save")}
            </Button>
          </>
        }
      >
        <form
          id="edit-role-form"
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
            label={t("Role name")}
            error={editForm.formState.errors.name?.message}
          >
            <Input
              placeholder={t("e.g. Employee")}
              {...editForm.register("name")}
            />
          </FormField>
        </form>
      </Modal>

      <Modal
        isOpen={!!permissionRole}
        title={t("Manage permissions")}
        subtitle={permissionRole?.name}
        onClose={closePermissionModal}
        modalClassName="rolesPermissionsModal"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={closePermissionModal}
              disabled={updatePermissionsMutation.isPending}
            >
              {t("Discard")}
            </Button>
            <Button
              type="submit"
              form="role-permissions-form"
              disabled={
                updatePermissionsMutation.isPending ||
                permissionsLoading ||
                permissionsIsError
              }
            >
              {updatePermissionsMutation.isPending
                ? t("Saving...")
                : t("Save permissions")}
            </Button>
          </>
        }
      >
        <form
          id="role-permissions-form"
          className="rolesPermissionsForm"
          onSubmit={(event) => {
            event.preventDefault();
            setPermissionError(null);
            updatePermissionsMutation.mutate();
          }}
        >
          <p className="rolesPermissionsHint">
            {t("Updating permissions will require a fresh sign in.")}
          </p>

          {permissionError && (
            <Alert variant="destructive">
              <AlertDescription>{permissionError}</AlertDescription>
            </Alert>
          )}

          {permissionsLoading && (
            <p className="rolesMessage">{t("Loading permissions...")}</p>
          )}

          {permissionsIsError && (
            <Alert variant="destructive">
              <AlertDescription>
                {permissionsErrorDetail instanceof Error
                  ? permissionsErrorDetail.message
                  : t("Failed to load permissions")}
              </AlertDescription>
            </Alert>
          )}

          {!permissionsLoading &&
            !permissionsIsError &&
            allPermissions.length === 0 && (
              <p className="rolesMessage">{t("No permissions available.")}</p>
            )}

          {!permissionsLoading &&
            !permissionsIsError &&
            groupedPermissions.length > 0 && (
              <>
                <div className="rolesPermissionsSummary">
                  {t("Selected permissions")}: {selectedPermissionIds.length}
                </div>
                <div className="rolesPermissionsGroups">
                  {groupedPermissions.map((group) => (
                    <section key={group.name} className="rolesPermissionGroup">
                      <h3 className="rolesPermissionGroupTitle">
                        {group.name}
                      </h3>
                      <div className="rolesPermissionList">
                        {group.permissions.map((permission) => (
                          <label
                            key={permission.id}
                            className="rolesPermissionOption flex items-center gap-2"
                          >
                            <Checkbox
                              checked={selectedPermissionIds.includes(permission.id)}
                              onCheckedChange={() => togglePermission(permission.id)}
                            />
                            <span>{permission.name}</span>
                          </label>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            )}
        </form>
      </Modal>
    </section>
  );
}
