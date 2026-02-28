"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { usePermissions } from "@/app/providers/AuthProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import ConfirmModal from "../../../components/Modal/ConfirmModal";
import Modal from "../../../components/Modal/Modal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import {
  deleteRole as deleteRoleApi,
  getRoles,
  type Role,
  updateRole as updateRoleApi,
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

export default function RolesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
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
        if (result.status === 401) router.push("/login");
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
    mutationFn: (id: string) => deleteRoleApi(id),
    onSuccess: (result) => {
      if (result.ok) {
        setRoleToDelete(null);
        queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
      } else {
        if (result.status === 401) router.push("/login");
      }
    },
  });

  const onEditSubmit = (data: CreateRoleFormValues) => {
    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, values: data });
    }
  };

  const handleConfirmDelete = () => {
    if (roleToDelete) deleteMutation.mutate(roleToDelete.id);
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

  return (
    <section className="rolesPage">
      <div className="breadcrumb">
        <span>Accounts</span> {"›"} Roles
      </div>

      <div className="rolesHeader">
        <div className="rolesHeaderText">
          <h1 className="pageTitle">Roles</h1>
          <p className="pageSubtitle">
            Manage roles and permissions for your team
          </p>
        </div>
        {canCreate && (
          <Link
            href="/dashboard/accounts/roles/create"
            className="button buttonPrimary"
          >
            Create role
          </Link>
        )}
      </div>

      <div className="rolesSearch">
        <span className="searchIcon">🔍</span>
        <input
          className="searchInput"
          placeholder="Search roles"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search roles"
        />
      </div>

      <div className="rolesTable">
        <div className="rolesRow rolesRowHeader">
          <span>Role</span>
          <span />
        </div>
        {rolesLoading && (
          <div className="rolesRow">
            <span className="rolesMessage">Loading roles…</span>
            <span />
          </div>
        )}
        {rolesError && (
          <div className="rolesRow">
            <span className="rolesMessage rolesError">
              {rolesErrorDetail instanceof Error
                ? rolesErrorDetail.message
                : "Failed to load roles"}
            </span>
            <span />
          </div>
        )}
        {!rolesLoading && !rolesError && roles.length === 0 && (
          <div className="rolesRow">
            <span className="rolesMessage">
              No roles yet. Create one to get started.
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
                No roles match &quot;{searchQuery.trim()}&quot;.
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
                      aria-label="More options"
                      aria-expanded={openMenuId === role.id}
                    >
                      ⋮
                    </button>
                    {openMenuId === role.id && (
                      <div className="rolesMenuDropdown">
                        {canUpdate && (
                          <button
                            type="button"
                            className="rolesMenuItem"
                            onClick={() => {
                              setEditingRole(role);
                              setOpenMenuId(null);
                            }}
                          >
                            Edit
                          </button>
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
        title="Delete role"
        message={
          roleToDelete
            ? `Are you sure you want to delete "${roleToDelete.name}"? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleteMutation.isPending}
        onClose={() => setRoleToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      <Modal
        isOpen={!!editingRole}
        title="Edit Role"
        subtitle={editingRole?.name}
        onClose={() => setEditingRole(null)}
        footer={
          <>
            <button
              type="button"
              className="button modalButton"
              onClick={() => setEditingRole(null)}
            >
              Discard
            </button>
            <button
              type="submit"
              form="edit-role-form"
              className="button buttonPrimary modalButton"
              disabled={editLoading}
            >
              {editLoading ? "Saving…" : "Save"}
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
            <span className="label">Role name</span>
            <input
              className="input"
              placeholder="e.g. Employee"
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
    </section>
  );
}
