import type { Employee } from "@/handlers/employee";
import type { StoredUser } from "@/lib/auth/user";

/** Normalize API `id` fields (string vs number JSON) for comparison to JWT claims. */
export function normalizeRecordId(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Backend resolves clock identity with `Employee.id ===` a subject id from the JWT.
 * Use this to enable clock-in/out and to find an open attendance row for "self".
 */
export function findEmployeeForAttendanceClock(
  employees: Employee[],
  authUserId: string | null
): Employee | undefined {
  if (!employees.length) return undefined;
  const id = typeof authUserId === "string" ? authUserId.trim() : "";
  if (!id) return undefined;
  return employees.find((e) => normalizeRecordId(e.id) === id);
}

/** Try each candidate id (e.g. several JWT claims) until one matches an employee primary key. */
export function findEmployeeForAttendanceClockAmongCandidates(
  employees: Employee[],
  candidateIds: readonly string[] | null | undefined
): Employee | undefined {
  if (!employees.length || !candidateIds?.length) return undefined;
  const seen = new Set<string>();
  for (const raw of candidateIds) {
    const id = typeof raw === "string" ? raw.trim() : String(raw).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const hit = employees.find((e) => normalizeRecordId(e.id) === id);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Loose directory hint (JWT subject ids, login-stored user id, email / employeeId codes).
 * For display only — do not use to enable clock actions unless
 * {@link findEmployeeForAttendanceClockAmongCandidates} also returns a row.
 */
export function findEmployeeDirectoryHint(
  employees: Employee[],
  jwtSubjectIds: readonly string[],
  stored: StoredUser | null
): Employee | undefined {
  if (!employees.length) return undefined;

  const loginIdent = stored?.email?.trim().toLowerCase() ?? "";
  const storedEmpCode =
    typeof stored?.employeeId === "string" && stored.employeeId.trim() !== ""
      ? stored.employeeId.trim().toLowerCase()
      : "";

  for (const jid of jwtSubjectIds) {
    const id = jid.trim();
    if (!id) continue;
    const byJwt = employees.find((e) => normalizeRecordId(e.id) === id);
    if (byJwt) return byJwt;
  }

  if (typeof stored?.id === "string" && stored.id.trim() !== "") {
    const sid = stored.id.trim();
    const byStored = employees.find((e) => normalizeRecordId(e.id) === sid);
    if (byStored) return byStored;
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
