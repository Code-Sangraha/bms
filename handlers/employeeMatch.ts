import type { Employee } from "@/handlers/employee";
import type { StoredUser } from "@/lib/auth/user";

/** Match JWT / stored-login profile to a directory employee row for display and open-clock detection. */
export function findEmployeeMatchingAuthSubject(
  employees: Employee[],
  jwtUserId: string | null,
  stored: StoredUser | null
): Employee | undefined {
  if (!employees.length) return undefined;

  const loginIdent = stored?.email?.trim().toLowerCase() ?? "";
  const storedEmpCode =
    typeof stored?.employeeId === "string" && stored.employeeId.trim() !== ""
      ? stored.employeeId.trim().toLowerCase()
      : "";

  if (jwtUserId?.trim()) {
    const jid = jwtUserId.trim();
    const byJwt = employees.find((e) => e.userId === jid || e.id === jid);
    if (byJwt) return byJwt;
  }

  if (storedEmpCode) {
    const byCode = employees.find((e) => e.employeeId.trim().toLowerCase() === storedEmpCode);
    if (byCode) return byCode;
  }

  if (loginIdent) {
    return employees.find(
      (e) =>
        (typeof e.email === "string" && e.email.trim().toLowerCase() === loginIdent) ||
        e.employeeId.trim().toLowerCase() === loginIdent
    );
  }

  return undefined;
}
