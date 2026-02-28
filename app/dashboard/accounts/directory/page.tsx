"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { usePermissions } from "@/app/providers/AuthProvider";
import Pagination from "@/app/components/Pagination/Pagination";
import Modal from "../../../components/Modal/Modal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import {
  createEmployee as createEmployeeApi,
  getEmployees,
  type Employee,
} from "@/handlers/employee";
import { getDepartments } from "@/handlers/department";
import { getOutlets } from "@/handlers/outlet";
import { getRoles } from "@/handlers/role";
import {
  createEmployeeSchema,
  type CreateEmployeeFormValues,
} from "@/schema/employee";
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { canCreate } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLDivElement>(null);

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
        if (result.status === 401) router.push("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: DEPARTMENTS_QUERY_KEY,
    queryFn: async () => {
      const result = await getDepartments();
      if (!result.ok) {
        if (result.status === 401) router.push("/login");
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
  } = useForm<CreateEmployeeFormValues>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: defaultFormValues,
  });

  useEffect(() => {
    if (!isModalOpen) reset(defaultFormValues);
  }, [isModalOpen, reset]);

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
      employees.filter((emp) => {
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
    [employees, searchQuery, departmentFilter]
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
      } else {
        if (result.status === 401) router.push("/login");
        else setError("root", { message: result.error });
      }
    },
    onError: () => {
      setError("root", {
        message: "Something went wrong. Please try again.",
      });
    },
  });

  const onAddSubmit = (data: CreateEmployeeFormValues) => {
    createMutation.mutate(data);
  };

  const loading = isSubmitting || createMutation.isPending;

  return (
    <section className="directoryPage">
      <div className="breadcrumb">
        <span>Staff Management</span> {"›"} Directory
      </div>

      <div className="directoryHeader">
        <div className="directoryHeaderText">
          <h1 className="pageTitle">Employee Directory</h1>
          <p className="pageSubtitle">
            Manage employee information and roles
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="button buttonPrimary"
            onClick={() => setIsModalOpen(true)}
          >
            Add Employees
          </button>
        )}
      </div>

      <div className="directorySearch">
        <span className="searchIcon">🔍</span>
        <input
          className="searchInput"
          placeholder="Search employees"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search employees"
        />
      </div>

      <div className="directoryTable">
        <div className="directoryRow directoryRowHeader">
          <span>Employee ID</span>
          <span>IOT</span>
          <span>Name</span>
          <span>Role</span>
          <span>Department</span>
          <span>Contact</span>
          <span />
        </div>
        {employeesLoading && (
          <div className="directoryRow">
            <span className="directoryMessage">Loading employees…</span>
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {employeesError && (
          <div className="directoryRow">
            <span className="directoryMessage directoryError">
              {employeesErrorDetail instanceof Error
                ? employeesErrorDetail.message
                : "Failed to load employees"}
            </span>
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {!employeesLoading && !employeesError && employees.length === 0 && (
          <div className="directoryRow">
            <span className="directoryMessage">
              No employees yet. Add one to get started.
            </span>
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {!employeesLoading &&
          !employeesError &&
          employees.length > 0 &&
          filteredEmployees.length === 0 && (
            <div className="directoryRow">
              <span className="directoryMessage">
                No employees match &quot;{searchQuery.trim()}&quot;.
              </span>
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
        {!employeesLoading &&
          !employeesError &&
          paginatedEmployees.map((emp) => (
            <div key={emp.id} className="directoryRow">
              <span>{emp.employeeId}</span>
              <span>{emp.iot}</span>
              <span>{emp.name}</span>
              <span>{getRoleName(emp)}</span>
              <span>{getDepartmentName(emp)}</span>
              <span>
                <span className="directoryContactPrimary">{emp.contact}</span>
                {emp.email && (
                  <span className="directoryContactSecondary">{emp.email}</span>
                )}
              </span>
              <div
                className="directoryMenuWrap"
                ref={openMenuId === emp.id ? menuButtonRef : undefined}
              >
                <button
                  type="button"
                  className="directoryMenuTrigger"
                  onClick={() =>
                    setOpenMenuId((id) => (id === emp.id ? null : emp.id))
                  }
                  aria-label="More options"
                  aria-expanded={openMenuId === emp.id}
                >
                  ⋮
                </button>
                {openMenuId === emp.id && (
                  <div className="directoryMenuDropdown">
                    <button type="button" className="directoryMenuItem">
                      Edit
                    </button>
                    <button type="button" className="directoryMenuItem directoryMenuItemDanger">
                      Delete
                    </button>
                  </div>
                )}
              </div>
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
        title="Register employee"
        subtitle="Add a new employee to the directory"
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
              form="add-employee-form"
              className="button buttonPrimary modalButton"
              disabled={loading}
            >
              {loading ? "Saving…" : "Save"}
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
            <span className="label">Employee ID</span>
            <input
              className="input"
              placeholder="e.g. TXN-001"
              {...register("employeeId")}
            />
            {errors.employeeId && (
              <span className="directoryFieldError">
                {errors.employeeId.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">IOT</span>
            <input
              className="input"
              placeholder="e.g. 1ab2c58a"
              {...register("iot")}
            />
            {errors.iot && (
              <span className="directoryFieldError">{errors.iot.message}</span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Name</span>
            <input
              className="input"
              placeholder="e.g. Employ number one"
              {...register("name")}
            />
            {errors.name && (
              <span className="directoryFieldError">
                {errors.name.message}
              </span>
            )}
          </label>
          <label className="modalField">
            <span className="label">Department</span>
            <select className="select" {...register("departmentId")}>
              <option value="">Select department</option>
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
            <span className="label">Outlet</span>
            <select className="select" {...register("outletId")}>
              <option value="">Select outlet</option>
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
            <span className="label">Role</span>
            <select className="select" {...register("roleId")}>
              <option value="">Select role</option>
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
            <span className="label">Contact</span>
            <input
              className="input"
              placeholder="e.g. 9876543210"
              {...register("contact")}
            />
            {errors.contact && (
              <span className="directoryFieldError">
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
