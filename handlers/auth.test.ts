import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api/client";
import { AUTH_ROUTES } from "@/lib/api/routes";
import { getAuthAccess } from "@/handlers/auth";

vi.mock("@/lib/api/client", () => ({
  apiRequest: vi.fn(),
  getBaseUrl: vi.fn(),
}));

const mockedApiRequest = vi.mocked(apiRequest);

describe("auth access handler", () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it("unwraps the documented access response envelope", async () => {
    const access = {
      userId: "8cd8d6bd-c4bc-41f4-9811-123456789abc",
      accountType: "user" as const,
      role: {
        id: "b93acaa5-1eb5-47f9-981c-ad95ba2024e0",
        name: "Admin",
        isAdmin: true,
      },
      permissions: ["user:create", "role:read"],
      outletId: null,
      accessScope: "global" as const,
    };
    mockedApiRequest.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        message: "Access details found successfully",
        data: access,
      },
    });

    await expect(getAuthAccess()).resolves.toEqual({ ok: true, data: access });
    expect(mockedApiRequest).toHaveBeenCalledWith(AUTH_ROUTES.ACCESS, {
      method: "GET",
    });
  });

  it("passes authentication failures through unchanged", async () => {
    const failure = { ok: false as const, error: "Invalid token", status: 401 };
    mockedApiRequest.mockResolvedValueOnce(failure);

    await expect(getAuthAccess()).resolves.toEqual(failure);
  });

  it("rejects a malformed successful response", async () => {
    mockedApiRequest.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        message: "Access details found successfully",
        data: { permissions: [] },
      },
    });

    await expect(getAuthAccess()).resolves.toEqual({
      ok: false,
      error: "Invalid access response",
      status: 502,
    });
  });
});
