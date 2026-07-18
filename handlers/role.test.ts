import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api/client";
import { ROLE_ROUTES } from "@/lib/api/routes";
import {
  getPermissions,
  getRoles,
  updateRolePermissions,
} from "@/handlers/role";

vi.mock("@/lib/api/client", () => ({
  apiRequest: vi.fn(),
  getApiErrorMessage: (value: { message?: string }) => value.message ?? "Request failed.",
}));

const mockedApiRequest = vi.mocked(apiRequest);

describe("role handlers", () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it("normalizes roles from the backend data field", async () => {
    mockedApiRequest.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        data: [{ id: "role-1", name: "Manager", permissions: [], permissionIds: [] }],
      },
    });

    await expect(getRoles()).resolves.toEqual({
      ok: true,
      data: [{ id: "role-1", name: "Manager", permissions: [], permissionIds: [] }],
    });
    expect(mockedApiRequest).toHaveBeenCalledWith(ROLE_ROUTES.GET, {
      method: "GET",
    });
  });

  it("normalizes permissions from the backend data field", async () => {
    mockedApiRequest.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        data: [{ id: "permission-1", name: "role:create" }],
      },
    });

    await expect(getPermissions()).resolves.toEqual({
      ok: true,
      data: [{ id: "permission-1", name: "role:create" }],
    });
    expect(mockedApiRequest).toHaveBeenCalledWith(ROLE_ROUTES.PERMISSIONS, {
      method: "GET",
    });
  });

  it("normalizes required role permission fields and deduplicates ids", async () => {
    mockedApiRequest.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        data: [{
          id: "role-1",
          name: "Manager",
          permissions: [{ id: "p-1", name: "role:read" }],
          permissionIds: ["p-1", "p-1"],
        }],
      },
    });
    await expect(getRoles()).resolves.toEqual({
      ok: true,
      data: [{
        id: "role-1",
        name: "Manager",
        permissions: [{ id: "p-1", name: "role:read" }],
        permissionIds: ["p-1"],
      }],
    });
  });
  it("passes failed permission responses through unchanged", async () => {
    const failure = { ok: false as const, error: "Forbidden", status: 403 };
    mockedApiRequest.mockResolvedValueOnce(failure);

    await expect(getPermissions()).resolves.toEqual(failure);
  });

  it("allows an empty permission replacement array", async () => {
    mockedApiRequest.mockResolvedValueOnce({ ok: true, data: { success: true, data: { roleId: "role-1", permissionIds: [] } } });
    await updateRolePermissions({ roleId: "role-1", permissionIds: [] });
    expect(mockedApiRequest).toHaveBeenCalledWith(
      ROLE_ROUTES.UPDATE_PERMISSIONS,
      { method: "POST", body: JSON.stringify({ roleId: "role-1", permissionIds: [] }) }
    );
  });
  it("sends the role permissions replacement payload", async () => {
    mockedApiRequest.mockResolvedValueOnce({
      ok: true,
      data: { success: true, message: "Role permissions updated" },
    });

    await updateRolePermissions({
      roleId: "role-1",
      permissionIds: ["permission-1", "permission-2"],
    });

    expect(mockedApiRequest).toHaveBeenCalledWith(
      ROLE_ROUTES.UPDATE_PERMISSIONS,
      {
        method: "POST",
        body: JSON.stringify({
          roleId: "role-1",
          permissionIds: ["permission-1", "permission-2"],
        }),
      }
    );
  });
});
