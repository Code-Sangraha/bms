import { describe, expect, it } from "vitest";
import { resolveMainOutletAdminAccess } from "./useMainOutletInventoryAccess";

const outlets = [
  { id: "main-1", name: "Main Outlet", managerId: "", contact: "", status: true },
  { id: "branch-1", name: "Branch", managerId: "", contact: "", status: true },
];

describe("main outlet inventory access", () => {
  it("allows an admin whose outlet id matches the main outlet", () => {
    expect(resolveMainOutletAdminAccess({ roleName: "Admin", userOutletId: "main-1", userOutletName: null, outlets })).toBe(true);
  });
  it("requires explicit assignment even when the outlet name is main", () => {
    expect(resolveMainOutletAdminAccess({ roleName: "Admin", userOutletId: null, userOutletName: "main", outlets: [] })).toBe(false);
  });
  it("rejects non-admin and branch accounts", () => {
    expect(resolveMainOutletAdminAccess({ roleName: "Manager", userOutletId: "main-1", userOutletName: "Main Outlet", outlets })).toBe(false);
    expect(resolveMainOutletAdminAccess({ roleName: "Admin", userOutletId: "branch-1", userOutletName: "Branch", outlets })).toBe(false);
  });
});