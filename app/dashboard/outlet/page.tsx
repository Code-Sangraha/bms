"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { MoreHorizontal, Plus, Receipt } from "lucide-react";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import ConfirmModal from "../../components/Modal/ConfirmModal";
import Modal from "../../components/Modal/Modal";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
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
import { CardGridSkeleton } from "@/app/components/ui-ext/LoadingState";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [outletToDelete, setOutletToDelete] = useState<Outlet | null>(null);

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
        if (result.status === 401) navigate("/login");
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
        if (result.status === 401) navigate("/login");
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
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateOutletFormValues>({
    resolver: zodResolver(createOutletSchema),
    defaultValues: defaultAddFormValues,
  });

  useEffect(() => {
    if (!isAddModalOpen) reset(defaultAddFormValues);
  }, [isAddModalOpen, reset]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOutletApi(id),
    onSuccess: (result) => {
      if (result.ok) {
        setOutletToDelete(null);
        queryClient.invalidateQueries({ queryKey: OUTLETS_QUERY_KEY });
      } else {
        if (result.status === 401) navigate("/login");
        else showToast(result.error);
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
        <span>{t("Dashboard")}</span> {"›"} {t("Outlet Management")}
      </div>

      <div className="outletHeader">
        <div className="outletHeaderText">
          <h1 className="pageTitle">{t("Outlet Management")}</h1>
          <p className="pageSubtitle">
            {t("Manage processing plants, retail stores, and distribution centers")}
          </p>
        </div>
        <div className="outletHeaderActions">
          <Button asChild variant="outline">
            <Link to="/dashboard/outlets/expenses">
              <Receipt className="h-4 w-4" aria-hidden />
              {t("Outlet expenses")}
            </Link>
          </Button>
          {canCreate && (
            <Button type="button" onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              {t("Add Outlet")}
            </Button>
          )}
        </div>
      </div>

      {outletsLoading && <CardGridSkeleton items={3} />}
      {outletsError && (
        <ErrorState
          title={t("Failed to load outlets")}
          description={
            outletsErrorDetail instanceof Error
              ? outletsErrorDetail.message
              : undefined
          }
        />
      )}
      {!outletsLoading && !outletsError && outlets.length === 0 && (
        <EmptyState
          title={t("No outlets yet. Add one to get started.")}
          action={
            canCreate ? (
              <Button type="button" onClick={() => setIsAddModalOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                {t("Add Outlet")}
              </Button>
            ) : undefined
          }
        />
      )}

      {!outletsLoading && !outletsError && outlets.length > 0 && (
        <div className="cardList">
          {paginatedOutlets.map((outlet) => (
          <article key={outlet.id} className="card">
            <div className="cardTop">
              <div className="cardTitleBlock">
                <h2 className="cardTitle">{outlet.name}</h2>
                <span className="cardId">{outlet.id}</span>
              </div>
              <div className="badgeGroup">
                <Badge variant={outlet.status ? "default" : "secondary"}>
                  {outlet.status ? t("Active") : t("Inactive")}
                </Badge>
                {canDelete && (
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
                      <DropdownMenuItem
                        onSelect={() => setOutletToDelete(outlet)}
                        className="text-destructive focus:text-destructive"
                      >
                        {t("Delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            <div className="cardBody">
              <label className="field">
                <span className="label">{t("Manager")}</span>
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
                <span className="label">{t("Contact")}</span>
                <input
                  className="input"
                  value={outlet.contact}
                  readOnly
                />
              </label>

              <label className="field">
                <span className="label">{t("Status")}</span>
                <select
                  className="select"
                  value={outlet.status ? "Active" : "Inactive"}
                  disabled
                  aria-readonly="true"
                >
                  <option value="Active">{t("Active")}</option>
                  <option value="Inactive">{t("Inactive")}</option>
                </select>
              </label>
            </div>

            {canUpdate && (
              <div className="cardActions">
                <Button
                  type="button"
                  onClick={() => setSelectedOutletId(outlet.id)}
                >
                  {t("Edit")}
                </Button>
              </div>
            )}
          </article>
          ))}
        </div>
      )}

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
        title={t("Delete outlet")}
        message={
          outletToDelete
            ? `${t("Are you sure you want to delete")} "${outletToDelete.name}"? ${t("This action cannot be undone.")}`
            : ""
        }
        confirmLabel={t("Delete")}
        cancelLabel={t("Cancel")}
        variant="danger"
        loading={deleteMutation.isPending}
        onClose={() => setOutletToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      <Modal
        isOpen={isAddModalOpen}
        title={t("Add Outlet")}
        subtitle={t("Quickly add a new outlet to your organization")}
        onClose={() => setIsAddModalOpen(false)}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddModalOpen(false)}
            >
              {t("Discard")}
            </Button>
            <Button type="submit" form="add-outlet-form" disabled={loading}>
              {loading ? t("Saving…") : t("Save")}
            </Button>
          </>
        }
      >
        <form
          id="add-outlet-form"
          onSubmit={handleSubmit(onAddSubmit)}
          className="space-y-4"
        >
          {errors.root?.message && (
            <Alert variant="destructive">
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}
          <FormField label={t("Outlet name")} error={errors.name?.message}>
            <Input
              placeholder={t("e.g. Main processing plant")}
              {...register("name")}
            />
          </FormField>
          <FormField label={t("Manager")} error={errors.managerId?.message}>
            <Controller
              control={control}
              name="managerId"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select manager")} />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName ?? user.email ?? user.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label={t("Contact")} error={errors.contact?.message}>
            <Input placeholder={t("e.g. 987654321")} {...register("contact")} />
          </FormField>
          <FormField label={t("Status")}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">{t("Active")}</SelectItem>
                    <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </form>
      </Modal>
    </section>
  );
}

