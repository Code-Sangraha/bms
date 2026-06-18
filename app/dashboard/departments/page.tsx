"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
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
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
        <span>{t("Dashboard")}</span> {"›"} {t("Department")}
      </div>

      <div className="departmentsHeader">
        <div className="departmentsHeaderText">
          <h1 className="pageTitle">{t("Department")}</h1>
          <p className="pageSubtitle">
            {t("Organize your team by departments for clarity")}
          </p>
        </div>
        {canCreate && (
          <Button type="button" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t("Add Department")}
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
          placeholder={t("Search departments")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t("Search departments")}
          className="pl-8"
        />
      </div>

      {departmentsLoading && <TableSkeleton rows={6} columns={3} />}
      {departmentsError && (
        <ErrorState
          title={t("Failed to load departments")}
          description={
            departmentsErrorDetail instanceof Error
              ? departmentsErrorDetail.message
              : undefined
          }
        />
      )}
      {!departmentsLoading && !departmentsError && departments.length === 0 && (
        <EmptyState
          title={t("No departments yet. Add one to get started.")}
          action={
            canCreate ? (
              <Button type="button" onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                {t("Add Department")}
              </Button>
            ) : undefined
          }
        />
      )}
      {!departmentsLoading &&
        !departmentsError &&
        departments.length > 0 &&
        filteredDepartments.length === 0 && (
          <EmptyState title={`${t("No departments match")} "${searchQuery.trim()}"`} />
        )}
      {!departmentsLoading &&
        !departmentsError &&
        filteredDepartments.length > 0 && (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Department")}</TableHead>
                  <TableHead>{t("Status")}</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDepartments.map((department) => (
                  <TableRow key={department.id}>
                    <TableCell className="font-medium">{department.name}</TableCell>
                    <TableCell>
                      <Badge variant={department.status ? "default" : "secondary"}>
                        {department.status ? t("Active") : t("Inactive")}
                      </Badge>
                    </TableCell>
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
                              <DropdownMenuItem
                                onSelect={() => setEditingDepartment(department)}
                              >
                                {t("Edit")}
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem
                                onSelect={() => setDepartmentToDelete(department)}
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingDepartment(null)}
            >
              {t("Discard")}
            </Button>
            <Button
              type="submit"
              form="edit-department-form"
              disabled={editLoading}
            >
              {editLoading ? t("Saving…") : t("Save")}
            </Button>
          </>
        }
      >
        <form
          id="edit-department-form"
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
            label={t("Department name")}
            error={editForm.formState.errors.name?.message}
          >
            <Input
              placeholder={t("e.g. Production")}
              {...editForm.register("name")}
            />
          </FormField>
          <FormField label={t("Status")}>
            <Controller
              control={editForm.control}
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

      <Modal
        isOpen={isModalOpen}
        title={t("Add Department")}
        subtitle={t("Quickly add a new department")}
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
            <Button
              type="submit"
              form="add-department-form"
              disabled={addLoading}
            >
              {addLoading ? t("Saving…") : t("Save")}
            </Button>
          </>
        }
      >
        <form
          id="add-department-form"
          onSubmit={addForm.handleSubmit(onAddSubmit)}
          className="space-y-4"
        >
          {addForm.formState.errors.root?.message && (
            <Alert variant="destructive">
              <AlertDescription>
                {addForm.formState.errors.root.message}
              </AlertDescription>
            </Alert>
          )}
          <FormField
            label={t("Department name")}
            error={addForm.formState.errors.name?.message}
          >
            <Input
              placeholder={t("e.g. Production")}
              {...addForm.register("name")}
            />
          </FormField>
          <FormField label={t("Status")}>
            <Controller
              control={addForm.control}
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

