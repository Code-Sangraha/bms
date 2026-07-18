import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api/client";
import { ATTENDANCE_ROUTES } from "@/lib/api/routes";
import { clockIn, clockOut } from "./attendance";

vi.mock("@/lib/api/client", () => ({
  apiRequest: vi.fn(),
  getApiErrorMessage: () => "Request failed.",
  getBaseUrl: () => "",
  retryAfterUnauthorized: vi.fn(),
}));
const mockedApiRequest = vi.mocked(apiRequest);

describe("attendance clock contract", () => {
  beforeEach(() => mockedApiRequest.mockReset());
  it("sends clock-in and clock-out without request bodies", async () => {
    mockedApiRequest.mockResolvedValue({ ok: true, data: { success: true } });
    await clockIn();
    await clockOut();
    expect(mockedApiRequest).toHaveBeenNthCalledWith(1, ATTENDANCE_ROUTES.CLOCK_IN, { method: "POST" });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(2, ATTENDANCE_ROUTES.CLOCK_OUT, { method: "POST" });
  });
});