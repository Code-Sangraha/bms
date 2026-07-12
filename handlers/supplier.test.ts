vi.mock("axios", () => ({ default: { request: vi.fn() } }));
import { afterEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import {
  createSupplier,
  deleteSupplier,
  getSupplierById,
  getSuppliers,
  updateSupplier,
  normalizeSupplier,
} from "./supplier";
import { supplierSchema } from "@/schema/supplier";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(axios.request).mockReset();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("supplier contract", () => {
  it("normalizes nullable supplier fields", () => {
    expect(
      normalizeSupplier({
        id: "supplier-1",
        name: "ABC",
        contact: null,
        outletId: null,
        status: true,
        createdBy: null,
        updatedBy: null,
        createdAt: "2026-07-12T08:00:00.000Z",
        updatedAt: "2026-07-12T08:00:00.000Z",
        deletedAt: null,
      }),
    ).toMatchObject({ id: "supplier-1", contact: null, outletId: null, status: true });
  });

  it("uses the outlet query parameter for scoped lists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSuppliers("outlet 1");

    expect(result).toEqual({ ok: true, data: [] });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/suppliers/get?outletId=outlet%201");
  });

  it("trims create payload fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, message: "Supplier created successfully", data: {} }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createSupplier({
      name: "  ABC  ",
      contact: " 9800000000 ",
      outletId: " outlet-1 ",
      createdBy: "user-1",
    });

    expect(result.ok).toBe(true);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      name: "ABC",
      contact: "9800000000",
      outletId: "outlet-1",
      createdBy: "user-1",
    });
  });

  it("sends the complete trimmed update payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, message: "Supplier updated successfully", data: {} }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateSupplier({
      id: "supplier-1",
      name: "  Updated  ",
      contact: " 9811111111 ",
      outletId: " outlet-1 ",
    });

    expect(result.ok).toBe(true);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      id: "supplier-1",
      name: "Updated",
      contact: "9811111111",
      outletId: "outlet-1",
    });
  });

  it("sends delete IDs in the request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, message: "Supplier deleted successfully", data: null }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await deleteSupplier("supplier-1");

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.method).toBe("DELETE");
    expect(JSON.parse(String(request.body))).toEqual({ id: "supplier-1" });
  });

  it("uses a GET body for supplier get-by-id", async () => {
    vi.mocked(axios.request).mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: { id: "supplier-1", name: "ABC" },
      },
    } as never);

    const result = await getSupplierById("supplier-1");

    expect(result.ok).toBe(true);
    expect(vi.mocked(axios.request)).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", data: { id: "supplier-1" } }),
    );
  });
  it("requires all supplier form fields", () => {
    expect(supplierSchema.safeParse({ name: "", contact: "", outletId: "" }).success).toBe(false);
  });
});
