import { describe, expect, it } from "vitest";
import { shouldSignOutAfterPermissionUpdate } from "./permissionUpdate";

describe("role permission session handling", () => {
  it("signs out only when the current persisted role changed", () => {
    expect(shouldSignOutAfterPermissionUpdate("role-admin", "role-admin")).toBe(true);
    expect(shouldSignOutAfterPermissionUpdate("role-manager", "role-admin")).toBe(false);
    expect(shouldSignOutAfterPermissionUpdate("role-admin", null)).toBe(false);
  });
});