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
  createOutlet as createOutletApi,
  deleteOutlet as deleteOutletApi,
  getOutlets,
  type Outlet,
} from "@/handlers/outlet";
import { getUsers } from "@/handlers/user";
import { createOutletSchema, type CreateOutletFormValues } from "@/schema/outlet";
import "./outlet.scss";
import OutletEditModal from "./OutletEditModal";

const OUTLETS_QUERY_KEY = ["outlets"];
const USERS_QUERY_KEY = ["users"];

const defaultAddFormValues: CreateOutletFormValues = {
  name: "",
  managerId: "",
  contact: "",
  status: "Active",
};

export default function OutletPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [outletToDelete, setOutletToDelete] = useState<Outlet | null>(null);
  const menuButtonRef = useRef<HTMLDivElement>(null);

  const {
    data: outlets = [],
    isLoading: outletsLoading,
    isError: outletsError,
    error: outletsErrorDetail,
  } = useQuery({
    queryKey: OUTLETS_QUERY_KEY,
    queryFn: async () => {
      const result = await getOutlets();
      if (!result.ok) {
        if (result.status === 401) router.push("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const { data: users = [] } = useQuery({
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

  const managers = useMemo(() => {
    return users.filter((user) => {
      const r = user.role;
      const roleName =
        typeof r === "object" && r != null && "name" in r && typeof (r as { name: string }).name === "string"
          ? (r as { name: string }).name
          : typeof r === "string"
            ? r
            : "";
      return roleName.toLowerCase() === "manager";
    });
  }, [users]);

  const selectedOutlet = outlets.find(
    (outlet) => outlet.id === selectedOutletId
  );
  const closeEditModal = () => setSelectedOutletId(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateOutletFormValues>({
    resolver: zodResolver(createOutletSchema),
    defaultValues: defaultAddFormValues,
  });

  useEffect(() => {
    if (!isAddModalOpen) reset(defaultAddFormValues);
  }, [isAddModalOpen, reset]);

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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOutletApi(id),
    onSuccess: (result) => {
      if (result.ok) {
        setOutletToDelete(null);
        queryClient.invalidateQueries({ queryKey: OUTLETS_QUERY_KEY });
      } else {
        if (result.status === 401) router.push("/login");
      }
    },
  });

  const handleConfirmDelete = () => {
    if (outletToDelete) {
      deleteMutation.mutate(outletToDelete.id);
    }
  };

  const createMutation = useMutation({
    mutationFn: (values: CreateOutletFormValues) =>
      createOutletApi({
        name: values.name,
        managerId: values.managerId,
        contact: values.contact,
        status: values.status,
      }),
    onSuccess: (result) => {
      if (result.ok) {
        setIsAddModalOpen(false);
        queryClient.invalidateQueries({ queryKey: OUTLETS_QUERY_KEY });
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

  const onAddSubmit = (data: CreateOutletFormValues) => {
    createMutation.mutate(data);
  };

  const loading = isSubmitting || createMutation.isPending;

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(outlets.length, { defaultPageSize: 10 });
  const paginatedOutlets = useMemo(
    () => paginate(outlets, startIndex, endIndex),
    [outlets, startIndex, endIndex]
  );

  return (
    <section className="outletPage">
      <div className="breadcrumb">
        <span>Settings</span> {"›"} Outlet Management
      </div>

      <div className="outletHeader">
        <div className="outletHeaderText">
          <h1 className="pageTitle">Outlet Management</h1>
          <p className="pageSubtitle">
            Manage processing plants, retail stores, and distribution centers
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="button buttonPrimary"
            onClick={() => setIsAddModalOpen(true)}
          >
            Add Outlet
          </button>
        )}
      </div>

      <div className="cardList">
        {outletsLoading && (
          <p className="outletPageMessage">Loading outlets…</p>
        )}
        {outletsError && (
          <p className="outletPageMessage outletPageError">
            {outletsErrorDetail instanceof Error
              ? outletsErrorDetail.message
              : "Failed to load outlets"}
          </p>
        )}
        {!outletsLoading && !outletsError && outlets.length === 0 && (
          <p className="outletPageMessage">No outlets yet. Add one to get started.</p>
        )}
        {!outletsLoading &&
          !outletsError &&
          paginatedOutlets.map((outlet) => (
          <article key={outlet.id} className="card">
            <div className="cardTop">
              <div className="cardTitleBlock">
                <h2 className="cardTitle">{outlet.name}</h2>
                <span className="cardId">{outlet.id}</span>
              </div>
              <div className="badgeGroup">
                <span
                  className={
                    outlet.status ? "badge badgeActive" : "badge"
                  }
                >
                  {outlet.status ? "Active" : "Inactive"}
                </span>
                {canDelete && (
                  <div
                    className="cardMenuWrap"
                    ref={openMenuId === outlet.id ? menuButtonRef : undefined}
                  >
                    <button
                      type="button"
                      className="cardMenuTrigger"
                      onClick={() =>
                        setOpenMenuId((id) => (id === outlet.id ? null : outlet.id))
                      }
                      aria-label="More options"
                      aria-expanded={openMenuId === outlet.id}
                    >
                      ⋮
                    </button>
                    {openMenuId === outlet.id && (
                      <div className="cardMenuDropdown">
                        <button
                          type="button"
                          className="cardMenuItem cardMenuItemDanger"
                          onClick={() => {
                            setOutletToDelete(outlet);
                            setOpenMenuId(null);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="cardBody">
              <label className="field">
                <span className="label">Manager</span>
                <input
                  className="input"
                  value={
                    users.find((u) => u.id === outlet.managerId)?.fullName ??
                    users.find((u) => u.id === outlet.managerId)?.email ??
                    outlet.managerId
                  }
                  readOnly
                />
              </label>

              <label className="field">
                <span className="label">Contact</span>
                <input
                  className="input"
                  value={outlet.contact}
                  readOnly
                />
              </label>

              <label className="field">
                <span className="label">Status</span>
                <select
                  className="select"
                  value={outlet.status ? "Active" : "Inactive"}
                  disabled
                  aria-readonly="true"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
            </div>

            <div className="cardActions">
              <button type="button" className="button">
                View details
              </button>
              {canUpdate && (
                <button
                  type="button"
                  className="button buttonPrimary"
                  onClick={() => setSelectedOutletId(outlet.id)}
                >
                  Edit
                </button>
              )}
            </div>
          </article>
          ))}
      </div>

      {!outletsLoading && !outletsError && outlets.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={outlets.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          pageSizeOptions={[10, 20, 50]}
          onPageSizeChange={setPageSize}
        />
      )}

      {selectedOutlet && (
        <OutletEditModal
          isOpen={Boolean(selectedOutletId)}
          outlet={selectedOutlet}
          onClose={closeEditModal}
          onSuccess={() =>
            queryClient.invalidateQueries({ queryKey: OUTLETS_QUERY_KEY })
          }
        />
      )}

      <ConfirmModal
        isOpen={!!outletToDelete}
        title="Delete outlet"
        message={
          outletToDelete
            ? `Are you sure you want to delete "${outletToDelete.name}"? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleteMutation.isPending}
        onClose={() => setOutletToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      <Modal
        isOpen={isAddModalOpen}
        title="Add Outlet"
        subtitle="Quickly add a new outlet to your organization"
        onClose={() => setIsAddModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="button modalButton"
              onClick={() => setIsAddModalOpen(false)}
            >
              Discard
            </button>
            <button
              type="submit"
              form="add-outlet-form"
              className="button buttonPrimary modalButton"
              disabled={loading}
            >
              {loading ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form
          id="add-outlet-form"
          onSubmit={handleSubmit(onAddSubmit)}
          className="outletAddForm"
        >
          {errors.root?.message && (
            <p className="outletFormError">{errors.root.message}</p>
          )}
          <label className="modalField">
            <span className="label">Outlet name</span>
            <input
              className="input"
              placeholder="e.g. Main processing plant"
              {...register("name")}
            />
            {errors.name && (
              <span className="outletFieldError">{errors.name.message}</span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Manager</span>
            <select className="select" {...register("managerId")}>
              <option value="">Select manager</option>
              {managers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName ?? user.email ?? user.id}
                </option>
              ))}
            </select>
            {errors.managerId && (
              <span className="outletFieldError">
                {errors.managerId.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Contact</span>
            <input
              className="input"
              placeholder="e.g. 987654321"
              {...register("contact")}
            />
            {errors.contact && (
              <span className="outletFieldError">
                {errors.contact.message}
              </span>
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

