"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import ConfirmModal from "../../../components/Modal/ConfirmModal";
import Modal from "../../../components/Modal/Modal";
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [permissionRole, setPermissionRole] = useState<Role | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const menuButtonRef = useRef<HTMLDivElement>(null);

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
          <Link
            to="/dashboard/accounts/roles/create"
            className="button buttonPrimary"
          >
            {t("Create role")}
          </Link>
        )}
      </div>

      <div className="rolesSearch">
        <span className="searchIcon">🔍</span>
        <input
          className="searchInput"
          placeholder={t("Search roles")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t("Search roles")}
        />
      </div>

      <div className="rolesTable">
        <div className="rolesRow rolesRowHeader">
          <span>{t("Role")}</span>
          <span />
        </div>
        {rolesLoading && (
          <div className="rolesRow">
            <span className="rolesMessage">{t("Loading roles…")}</span>
            <span />
          </div>
        )}
        {rolesError && (
          <div className="rolesRow">
            <span className="rolesMessage rolesError">
              {rolesErrorDetail instanceof Error
                ? rolesErrorDetail.message
                : t("Failed to load roles")}
            </span>
            <span />
          </div>
        )}
        {!rolesLoading && !rolesError && roles.length === 0 && (
          <div className="rolesRow">
            <span className="rolesMessage">
              {t("No roles yet. Create one to get started.")}
            </span>
            <span />
          </div>
        )}
        {!rolesLoading &&
          !rolesError &&
          roles.length > 0 &&
          filteredRoles.length === 0 && (
            <div className="rolesRow">
              <span className="rolesMessage">
                {t("No roles match")} &quot;{searchQuery.trim()}&quot;.
              </span>
              <span />
            </div>
          )}
        {!rolesLoading &&
          !rolesError &&
          paginatedRoles.map((role) => (
            <div key={role.id} className="rolesRow">
              <span>{role.name}</span>
              <div
                className="rolesMenuWrap"
                ref={openMenuId === role.id ? menuButtonRef : undefined}
              >
                {(canUpdate || canDelete) && (
                  <>
                    <button
                      type="button"
                      className="rolesMenuTrigger"
                      onClick={() =>
                        setOpenMenuId((id) => (id === role.id ? null : role.id))
                      }
                      aria-label={t("More options")}
                      aria-expanded={openMenuId === role.id}
                    >
                      ⋮
                    </button>
                    {openMenuId === role.id && (
                      <div className="rolesMenuDropdown">
                        {canUpdate && (
                          <>
                            <button
                              type="button"
                              className="rolesMenuItem"
                              onClick={() => {
                                setEditingRole(role);
                                setOpenMenuId(null);
                              }}
                            >
                              {t("Edit")}
                            </button>
                            <button
                              type="button"
                              className="rolesMenuItem"
                              onClick={() => {
                                openPermissionModal(role);
                                setOpenMenuId(null);
                              }}
                            >
                              {t("Manage permissions")}
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="rolesMenuItem rolesMenuItemDanger"
                            onClick={() => {
                              setRoleToDelete(role);
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
            <button
              type="button"
              className="button modalButton"
              onClick={() => setEditingRole(null)}
            >
              {t("Discard")}
            </button>
            <button
              type="submit"
              form="edit-role-form"
              className="button buttonPrimary modalButton"
              disabled={editLoading}
            >
              {editLoading ? t("Saving…") : t("Save")}
            </button>
          </>
        }
      >
        <form
          id="edit-role-form"
          onSubmit={editForm.handleSubmit(onEditSubmit)}
          className="rolesAddForm"
        >
          {editForm.formState.errors.root?.message && (
            <p className="rolesFormError">
              {editForm.formState.errors.root.message}
            </p>
          )}
          <label className="modalField">
            <span className="label">{t("Role name")}</span>
            <input
              className="input"
              placeholder={t("e.g. Employee")}
              {...editForm.register("name")}
            />
            {editForm.formState.errors.name && (
              <span className="rolesFieldError">
                {editForm.formState.errors.name.message}
              </span>
            )}
          </label>
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
            <button
              type="button"
              className="button modalButton"
              onClick={closePermissionModal}
              disabled={updatePermissionsMutation.isPending}
            >
              {t("Discard")}
            </button>
            <button
              type="submit"
              form="role-permissions-form"
              className="button buttonPrimary modalButton"
              disabled={
                updatePermissionsMutation.isPending ||
                permissionsLoading ||
                permissionsIsError
              }
            >
              {updatePermissionsMutation.isPending
                ? t("Saving...")
                : t("Save permissions")}
            </button>
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
            <p className="rolesFormError" role="alert">
              {permissionError}
            </p>
          )}

          {permissionsLoading && (
            <p className="rolesMessage">{t("Loading permissions...")}</p>
          )}

          {permissionsIsError && (
            <p className="rolesFormError" role="alert">
              {permissionsErrorDetail instanceof Error
                ? permissionsErrorDetail.message
                : t("Failed to load permissions")}
            </p>
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
                            className="rolesPermissionOption"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPermissionIds.includes(permission.id)}
                              onChange={() => togglePermission(permission.id)}
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
