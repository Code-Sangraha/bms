"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { IoPersonAddOutline, IoSettingsOutline } from "react-icons/io5";
import { useForm } from "react-hook-form";
import { useAuth, usePermissions } from "@/app/providers/AuthProvider";
import { useOutletAccess } from "@/app/providers/OutletAccessProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import Modal from "../../../components/Modal/Modal";
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
            <Link to={moreHref} className="directoryHeaderSettings" aria-label={t("Settings")}>
              <IoSettingsOutline size={22} aria-hidden />
            </Link>
          ) : null}
          {canCreate ? (
            <button
              type="button"
              className="button buttonPrimary directoryHeaderAddBtn"
              onClick={() => setIsModalOpen(true)}
            >
              {t("Add Employees")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="directorySearch">
        <span className="searchIcon">🔍</span>
        <input
          className="searchInput"
          placeholder={t("Search employees")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t("Search employees")}
        />
      </div>

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
        {employeesLoading && (
          <div className="directoryRow directoryRowMessage">
            <span className="directoryMessage">{t("Loading employees…")}</span>
          </div>
        )}
        {employeesError && (
          <div className="directoryRow directoryRowMessage">
            <span className="directoryMessage directoryError">
              {employeesErrorDetail instanceof Error
                ? employeesErrorDetail.message
                : t("Failed to load employees")}
            </span>
          </div>
        )}
        {!employeesLoading && !employeesError && employees.length === 0 && (
          <div className="directoryRow directoryRowMessage">
            <span className="directoryMessage">
              {t("No employees yet. Add one to get started.")}
            </span>
          </div>
        )}
        {!employeesLoading &&
          !employeesError &&
          employees.length > 0 &&
          employeesForDirectory.length === 0 && (
            <div className="directoryRow directoryRowMessage">
              <span className="directoryMessage">
                {t("No employees for this outlet.")}
              </span>
            </div>
          )}
        {!employeesLoading &&
          !employeesError &&
          employeesForDirectory.length > 0 &&
          filteredEmployees.length === 0 && (
            <div className="directoryRow directoryRowMessage">
              <span className="directoryMessage">
                {t("No employees match")} &quot;{searchQuery.trim()}&quot;.
              </span>
            </div>
          )}
        {!employeesLoading &&
          !employeesError &&
          paginatedEmployees.map((emp) => (
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
                <button
                  type="button"
                  className="button"
                  onClick={() => handleOpenEditEmployee(emp)}
                >
                  {t("Edit")}
                </button>
              ) : (
                <span aria-hidden="true" />
              )}
            </div>
          ))}
      </div>

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
            <button
              type="button"
              className="button modalButton"
              onClick={() => setIsModalOpen(false)}
            >
              {t("Discard")}
            </button>
            <button
              type="submit"
              form="add-employee-form"
              className="button buttonPrimary modalButton"
              disabled={loading}
            >
              {loading ? t("Saving…") : t("Save")}
            </button>
          </>
        }
      >
        <form
          id="add-employee-form"
          onSubmit={handleSubmit(onAddSubmit)}
          className="directoryForm"
        >
          {errors.root?.message && (
            <p className="directoryFormError">{errors.root.message}</p>
          )}
          <label className="modalField">
            <span className="label">{t("Employee Email")}</span>
            <input
              className="input"
              placeholder={t("e.g. TXN-001")}
              {...register("employeeId")}
            />
            {errors.employeeId && (
              <span className="directoryFieldError">
                {errors.employeeId.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">{t("IOT")}</span>
            <input
              className="input"
              placeholder={t("e.g. 1ab2c58a")}
              {...register("iot")}
            />
            {errors.iot && (
              <span className="directoryFieldError">{errors.iot.message}</span>
            )}
          </label>
          <label className="modalField">
            <span className="label">{t("Name")}</span>
            <input
              className="input"
              placeholder={t("e.g. Employ number one")}
              {...register("name")}
            />
            {errors.name && (
              <span className="directoryFieldError">
                {errors.name.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">{t("Department")}</span>
            <select className="select" {...register("departmentId")}>
              <option value="">{t("Select department")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {errors.departmentId && (
              <span className="directoryFieldError">
                {errors.departmentId.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">{t("Outlet")}</span>
            <select className="select" {...register("outletId")}>
              <option value="">{t("Select outlet")}</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            {errors.outletId && (
              <span className="directoryFieldError">
                {errors.outletId.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">{t("Role")}</span>
            <select className="select" {...register("roleId")}>
              <option value="">{t("Select role")}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {errors.roleId && (
              <span className="directoryFieldError">
                {errors.roleId.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">{t("Contact")}</span>
            <input
              className="input"
              placeholder={t("e.g. 9876543210")}
              {...register("contact")}
            />
            {errors.contact && (
              <span className="directoryFieldError">
                {errors.contact.message}
              </span>
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
            <button
              type="button"
              className="button modalButton"
              onClick={() => setEditEmployee(null)}
            >
              {t("Cancel")}
            </button>
            <button
              type="submit"
              form="edit-employee-form"
              className="button buttonPrimary modalButton"
              disabled={updateEmployeeMutation.isPending}
            >
              {updateEmployeeMutation.isPending ? t("Saving…") : t("Update")}
            </button>
          </>
        }
      >
        <form id="edit-employee-form" onSubmit={handleEditEmployeeSubmit} className="directoryForm">
          {editEmployeeError && (
            <p className="directoryFormError" role="alert">
              {editEmployeeError}
            </p>
          )}
          <label className="modalField">
            <span className="label">{t("Department")}</span>
            <select
              className="select"
              value={editDepartmentId}
              onChange={(e) => setEditDepartmentId(e.target.value)}
            >
              <option value="">{t("Select department")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="modalField">
            <span className="label">{t("Outlet")}</span>
            <select
              className="select"
              value={editOutletId}
              onChange={(e) => setEditOutletId(e.target.value)}
            >
              <option value="">{t("Select outlet")}</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="modalField">
            <span className="label">{t("Role")}</span>
            <select
              className="select"
              value={editRoleIdState}
              onChange={(e) => setEditRoleIdState(e.target.value)}
            >
              <option value="">{t("Select role")}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </form>
      </Modal>

      {canCreate ? (
        <button type="button" className="directoryFab" onClick={() => setIsModalOpen(true)}>
          <IoPersonAddOutline size={20} aria-hidden />
          <span>{t("Add Employees")}</span>
        </button>
      ) : null}
    </section>
  );
}
