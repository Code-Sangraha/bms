"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Search, Settings, UserPlus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useAuth, usePermissions } from "@/app/providers/AuthProvider";
import { useOutletAccess } from "@/app/providers/OutletAccessProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import Modal from "../../../components/Modal/Modal";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
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
import {
  createEmployee as createEmployeeApi,
  getEmployees,
  updateEmployee as updateEmployeeApi,
  type Employee,
} from "@/handlers/employee";
import { getDepartments } from "@/handlers/department";
import { getOutlets } from "@/handlers/outlet";
import { getRoles } from "@/handlers/role";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  type CreateEmployeeFormValues,
} from "@/schema/employee";
import { buildPathWithOutletScope, readOutletScopeFromSearch } from "@/lib/outletScope";
import { getOutletIdFromToken } from "@/lib/auth/role";
import { getStoredOutletId } from "@/lib/auth/user";
import "./directory.scss";

const EMPLOYEES_QUERY_KEY = ["employees"];
const DEPARTMENTS_QUERY_KEY = ["departments"];
const OUTLETS_QUERY_KEY = ["outlets"];
const ROLES_QUERY_KEY = ["roles"];

const defaultFormValues: CreateEmployeeFormValues = {
  employeeId: "",
  iot: "",
  name: "",
  departmentId: "",
  outletId: "",
  roleId: "",
  status: "Active",
  contact: "",
};

function resolveName(
  value: string | { name: string } | undefined,
  fallback: string
): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "name" in value) return value.name;
  return fallback;
}

export default function DirectoryPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate } = usePermissions();
  const { accessTier } = useOutletAccess();
  const { userOutletId } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const scopedOutletId = useMemo(() => readOutletScopeFromSearch(search), [search]);
  const moreHref = buildPathWithOutletScope("/dashboard/more", scopedOutletId, search);
  const canManageEmployees = canCreate || canUpdate;
  const sessionOutletId = getOutletIdFromToken() ?? getStoredOutletId();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [editDepartmentId, setEditDepartmentId] = useState("");
  const [editOutletId, setEditOutletId] = useState("");
  const [editRoleIdState, setEditRoleIdState] = useState("");
  const [editEmployeeError, setEditEmployeeError] = useState<string | null>(
    null
  );

  const {
    data: employees = [],
    isLoading: employeesLoading,
    isError: employeesError,
    error: employeesErrorDetail,
  } = useQuery({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: async () => {
      const result = await getEmployees();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  /** UI-only: outlet managers/staff see employees for their outlet (URL scope wins when set). */
  const directoryOutletFilterId = useMemo(() => {
    if (accessTier === "global") return null;
    return scopedOutletId ?? userOutletId ?? sessionOutletId ?? null;
  }, [accessTier, scopedOutletId, userOutletId, sessionOutletId]);

  const employeesForDirectory = useMemo(() => {
    if (!directoryOutletFilterId) return employees;
    return employees.filter((e) => e.outletId === directoryOutletFilterId);
  }, [employees, directoryOutletFilterId]);

  const { data: departments = [] } = useQuery({
    queryKey: DEPARTMENTS_QUERY_KEY,
    queryFn: async () => {
      const result = await getDepartments();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: canManageEmployees,
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
    enabled: canManageEmployees,
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
    enabled: canManageEmployees,
  });

  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateEmployeeFormValues>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: defaultFormValues,
  });

  useEffect(() => {
    reset(defaultFormValues);
  }, [isModalOpen, reset]);

  const getRoleName = (emp: Employee) => {
    const name = resolveName(emp.role, "");
    if (name) return name;
    return roles.find((r) => r.id === emp.roleId)?.name ?? "—";
  };

  const getDepartmentName = (emp: Employee) => {
    const name = resolveName(emp.department, "");
    if (name) return name;
    return departments.find((d) => d.id === emp.departmentId)?.name ?? "—";
  };

  const filteredEmployees = useMemo(
    () =>
      employeesForDirectory.filter((emp) => {
        const q = searchQuery.trim().toLowerCase();
        if (q) {
          const match =
            emp.employeeId.toLowerCase().includes(q) ||
            emp.iot.toLowerCase().includes(q) ||
            emp.name.toLowerCase().includes(q) ||
            getRoleName(emp).toLowerCase().includes(q) ||
            getDepartmentName(emp).toLowerCase().includes(q) ||
            emp.contact.toLowerCase().includes(q) ||
            (emp.email && emp.email.toLowerCase().includes(q));
          if (!match) return false;
        }
        if (departmentFilter) {
          if (emp.departmentId !== departmentFilter) return false;
        }
        return true;
      }),
    [employeesForDirectory, searchQuery, departmentFilter, roles, departments]
  );

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(filteredEmployees.length, { defaultPageSize: 10 });
  const paginatedEmployees = useMemo(
    () => paginate(filteredEmployees, startIndex, endIndex),
    [filteredEmployees, startIndex, endIndex]
  );

  const createMutation = useMutation({
    mutationFn: (values: CreateEmployeeFormValues) => createEmployeeApi(values),
    onSuccess: (result) => {
      if (result.ok) {
        setIsModalOpen(false);
        queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: ["users"] });
      } else {
        if (result.status === 401) navigate("/login");
        else setError("root", { message: result.error });
      }
    },
    onError: () => {
      setError("root", {
        message: t("Something went wrong. Please try again."),
      });
    },
  });

  const onAddSubmit = (data: CreateEmployeeFormValues) => {
    createMutation.mutate(data);
  };

  const handleOpenEditEmployee = (emp: Employee) => {
    setEditEmployee(emp);
    setEditDepartmentId(emp.departmentId);
    setEditOutletId(emp.outletId);
    setEditRoleIdState(emp.roleId);
    setEditEmployeeError(null);
  };

  const updateEmployeeMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateEmployeeApi>[0]) =>
      updateEmployeeApi(payload),
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        else
          setEditEmployeeError(result.error ?? t("Failed to update employee"));
        return;
      }
      setEditEmployee(null);
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      showToast(
        t(
          "Employee updated. Linked users may need to sign in again for outlet changes to apply."
        )
      );
    },
    onError: () => {
      setEditEmployeeError(t("Something went wrong. Please try again."));
    },
  });

  const handleEditEmployeeSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!editEmployee) return;
    const parsed = updateEmployeeSchema.safeParse({
      id: editEmployee.id,
      outletId: editOutletId.trim(),
      roleId: editRoleIdState.trim(),
      departmentId: editDepartmentId.trim(),
    });
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg =
        first.outletId?.[0] ??
        first.roleId?.[0] ??
        first.departmentId?.[0] ??
        first.id?.[0] ??
        t("Please select valid outlet, role, and department.");
      setEditEmployeeError(msg);
      return;
    }
    setEditEmployeeError(null);
    updateEmployeeMutation.mutate(parsed.data);
  };

  const loading = isSubmitting || createMutation.isPending;

  return (
    <section className="directoryPage">
      <div className="breadcrumb">
        <span>{t("Attendance")}</span> {"›"} {t("Directory")}
      </div>

      <div className="directoryHeader">
        <div className="directoryHeaderText">
          <h1 className="pageTitle">{t("Parties")}</h1>
          <p className="pageSubtitle">{t("Employee Directory")}</p>
        </div>
        <div className="directoryHeaderActions">
          {accessTier !== "outlet_staff" ? (
            <Button
              asChild
              variant="outline"
              size="icon"
              className="text-muted-foreground"
              aria-label={t("Settings")}
            >
              <Link to={moreHref}>
                <Settings className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          ) : null}
          {canCreate ? (
            <Button
              type="button"
              className="directoryHeaderAddBtn"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t("Add Employees")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative w-full sm:max-w-sm">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          placeholder={t("Search employees")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t("Search employees")}
          className="pl-8"
        />
      </div>

      {employeesLoading && <TableSkeleton rows={6} columns={7} />}
      {employeesError && (
        <ErrorState
          title={t("Failed to load employees")}
          description={
            employeesErrorDetail instanceof Error
              ? employeesErrorDetail.message
              : undefined
          }
        />
      )}
      {!employeesLoading && !employeesError && employees.length === 0 && (
        <EmptyState
          title={t("No employees yet. Add one to get started.")}
          action={
            canCreate ? (
              <Button type="button" onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                {t("Add Employees")}
              </Button>
            ) : undefined
          }
        />
      )}
      {!employeesLoading &&
        !employeesError &&
        employees.length > 0 &&
        employeesForDirectory.length === 0 && (
          <EmptyState title={t("No employees for this outlet.")} />
        )}
      {!employeesLoading &&
        !employeesError &&
        employeesForDirectory.length > 0 &&
        filteredEmployees.length === 0 && (
          <EmptyState title={`${t("No employees match")} "${searchQuery.trim()}"`} />
        )}
      {!employeesLoading && !employeesError && filteredEmployees.length > 0 && (
        <div className="directoryTable">
          <div className="directoryRow directoryRowHeader">
            <span>{t("Employee ID")}</span>
            <span>{t("IOT")}</span>
            <span>{t("Name")}</span>
            <span>{t("Role")}</span>
            <span>{t("Department")}</span>
            <span>{t("Contact")}</span>
            <span />
          </div>
          {paginatedEmployees.map((emp) => (
            <div key={emp.id} className="directoryRow directoryRowData">
              <span data-label={t("Employee ID")}>{emp.employeeId}</span>
              <span data-label={t("IOT")}>{emp.iot}</span>
              <span className="directoryCellName">{emp.name}</span>
              <span data-label={t("Role")}>{getRoleName(emp)}</span>
              <span data-label={t("Department")}>{getDepartmentName(emp)}</span>
              <span data-label={t("Contact")}>
                <span className="directoryContactPrimary">{emp.contact}</span>
                {emp.email && (
                  <span className="directoryContactSecondary">{emp.email}</span>
                )}
              </span>
              {canUpdate ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEditEmployee(emp)}
                >
                  {t("Edit")}
                </Button>
              ) : (
                <span aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      )}

      {!employeesLoading && !employeesError && filteredEmployees.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredEmployees.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          pageSizeOptions={[10, 20, 50]}
          onPageSizeChange={setPageSize}
        />
      )}

      <Modal
        isOpen={isModalOpen}
        title={t("Register employee")}
        subtitle={t("Add a new employee to the directory")}
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
              form="add-employee-form"
              disabled={loading}
            >
              {loading ? t("Saving…") : t("Save")}
            </Button>
          </>
        }
      >
        <form
          id="add-employee-form"
          onSubmit={handleSubmit(onAddSubmit)}
          className="space-y-4"
        >
          {errors.root?.message && (
            <Alert variant="destructive">
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}
          <FormField label={t("Employee Email")} error={errors.employeeId?.message}>
            <Input placeholder={t("e.g. TXN-001")} {...register("employeeId")} />
          </FormField>
          <FormField label={t("IOT")} error={errors.iot?.message}>
            <Input placeholder={t("e.g. 1ab2c58a")} {...register("iot")} />
          </FormField>
          <FormField label={t("Name")} error={errors.name?.message}>
            <Input placeholder={t("e.g. Employ number one")} {...register("name")} />
          </FormField>
          <FormField label={t("Department")} error={errors.departmentId?.message}>
            <Controller
              control={control}
              name="departmentId"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select department")} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
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
                    <SelectValue placeholder={t("Select outlet")} />
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
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label={t("Contact")} error={errors.contact?.message}>
            <Input placeholder={t("e.g. 9876543210")} {...register("contact")} />
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

      <Modal
        isOpen={!!editEmployee}
        title={t("Edit employee")}
        subtitle={
          editEmployee
            ? `${editEmployee.name} · ${editEmployee.employeeId}`
            : ""
        }
        onClose={() => setEditEmployee(null)}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditEmployee(null)}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              form="edit-employee-form"
              disabled={updateEmployeeMutation.isPending}
            >
              {updateEmployeeMutation.isPending ? t("Saving…") : t("Update")}
            </Button>
          </>
        }
      >
        <form
          id="edit-employee-form"
          onSubmit={handleEditEmployeeSubmit}
          className="space-y-4"
        >
          {editEmployeeError && (
            <Alert variant="destructive">
              <AlertDescription>{editEmployeeError}</AlertDescription>
            </Alert>
          )}
          <FormField label={t("Department")}>
            <Select
              value={editDepartmentId || undefined}
              onValueChange={setEditDepartmentId}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Select department")} />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t("Outlet")}>
            <Select value={editOutletId || undefined} onValueChange={setEditOutletId}>
              <SelectTrigger>
                <SelectValue placeholder={t("Select outlet")} />
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
          <FormField label={t("Role")}>
            <Select
              value={editRoleIdState || undefined}
              onValueChange={setEditRoleIdState}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Select role")} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </form>
      </Modal>

      {canCreate ? (
        <Button
          type="button"
          size="lg"
          className="directoryFab fixed bottom-6 right-6 z-40 shadow-lg lg:hidden"
          onClick={() => setIsModalOpen(true)}
        >
          <UserPlus className="h-5 w-5" aria-hidden />
          <span>{t("Add Employees")}</span>
        </Button>
      ) : null}
    </section>
  );
}
