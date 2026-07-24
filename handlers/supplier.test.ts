vi.mock("axios", () => ({ default: { request: vi.fn() } }));
import { afterEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import {
  createSupplier,
  deleteSupplier,
  getSupplierById,
  getSuppliers,
  getActiveSuppliers,
  updateSupplier,
  normalizeSupplier,
  getSupplierDetails,
  getSupplierPurchases,
  recordSupplierPayment,
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

  it("filters inactive suppliers only for inventory selection", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [{ id: "active", name: "Active", status: true }, { id: "inactive", name: "Inactive", status: false }] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getActiveSuppliers("outlet-1")).resolves.toMatchObject({ ok: true, data: [{ id: "active" }] });
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

  it("loads scoped supplier details from the REST route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: {
      id: "supplier-1", name: "ABC", status: true, summary: { totalDueAmount: 500 }, purchases: [],
    }}));
    vi.stubGlobal("fetch", fetchMock);
    const result = await getSupplierDetails("supplier-1", "outlet-1");
    expect(result.ok).toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/suppliers/supplier-1?outletId=outlet-1");
  });

  it("encodes supplier purchase filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { summary: {}, purchases: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    await getSupplierPurchases("supplier-1", { outletId: "outlet-1", paymentStatus: "PARTIAL", purchaseType: "ITEM_RESTOCK", from: "2026-07-01", to: "2026-07-31" });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("paymentStatus=PARTIAL");
    expect(url).toContain("purchaseType=ITEM_RESTOCK");
    expect(url).toContain("outletId=outlet-1");
  });

  it("records a supplier purchase payment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: {} }));
    vi.stubGlobal("fetch", fetchMock);
    await recordSupplierPayment("supplier-1", "expense-1", { amount: 500 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/suppliers/supplier-1/purchases/expense-1/payments");
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({ amount: 500 });
  });
});
