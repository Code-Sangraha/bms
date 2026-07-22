import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCreditor,
  createCreditorPayLater,
  getCreditors,
  getCreditorDetail,
  payCreditor,
  parseCreditor,
  parseCreditorDetail,
  parseCreditorOrder,
  parseCreditorPayment,
} from "./creditor";
import { creditorSchema } from "@/schema/creditor";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("creditor contract", () => {
  it("parses a creditor with contact fallback", () => {
    expect(
      parseCreditor({
        id: "cred-1",
        name: "Client 1",
        contact: "9819352555",
        address: "Dharan 10",
      }),
    ).toMatchObject({ id: "cred-1", phone: "9819352555", address: "Dharan 10" });
  });

  it("requires id, name, and phone", () => {
    expect(parseCreditor({ id: "x", name: "y" })).toBeNull();
    expect(parseCreditor({ name: "y", phone: "1" })).toBeNull();
  });

  it("uses the search query parameter when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getCreditors("Dharan");

    expect(result).toEqual({ ok: true, data: [] });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/creditors?search=Dharan");
  });

  it("omits search when blank", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getCreditors("   ");

    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("search");
  });

  it("trims create payload fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: {} }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createCreditor({
      name: "  Client 1  ",
      address: "  Dharan 10  ",
      phone: "  9819352555  ",
    });

    expect(result.ok).toBe(true);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      name: "Client 1",
      address: "Dharan 10",
      phone: "9819352555",
    });
  });

  it("builds the detail path with encoded id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          id: "cred 1",
          name: "Client 1",
          phone: "9819352555",
          address: "Dharan 10",
          totalAmount: 5000,
          pendingAmount: 3000,
          orders: [],
          payments: [],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getCreditorDetail("cred 1");

    expect(result.ok).toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/creditors/cred%201");
  });

  it("maps pay-later payload unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, message: "Pay later recorded" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createCreditorPayLater({
      creditorId: "cred-uuid",
      outletId: "outlet-1",
      sourceType: "POS",
      sourceTransactionId: "TXN-154",
      items: [
        { productId: "product-uuid", name: "Buff Meat", weight: 2, unitPrice: 500, amount: 1000 },
      ],
      totalAmount: 1000,
    });

    expect(result.ok).toBe(true);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      creditorId: "cred-uuid",
      outletId: "outlet-1",
      sourceType: "POS",
      sourceTransactionId: "TXN-154",
      items: [
        { productId: "product-uuid", name: "Buff Meat", weight: 2, unitPrice: 500, amount: 1000 },
      ],
      totalAmount: 1000,
    });
  });

  it("coerces payment method to API enum and omits blank reference", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await payCreditor("cred-1", {
      amount: 4700,
      discountAmount: 75,
      paymentMethod: "cash",
      outletId: "outlet-1",
      reference: "   ",
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.paymentMethod).toBe("CASH");
    expect(body).not.toHaveProperty("reference");
    expect(body.amount).toBe(4700);
    expect(body.discountAmount).toBe(75);
  });

  it("sends reference when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await payCreditor("cred-1", {
      amount: 1000,
      paymentMethod: "online",
      outletId: "outlet-1",
      reference: "Received by cashier",
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body)).reference).toBe("Received by cashier");
  });

  it("parses detail with balance, orders, and payments", () => {
    const detail = parseCreditorDetail({
      id: "c1",
      name: "Client 1",
      phone: "9819352555",
      address: "Dharan 10",
      totalAmount: "5000",
      pendingAmount: "3000",
      orders: [
        {
          outletId: "outlet-1",
      sourceType: "POS",
          sourceTransactionId: "TXN-1",
          totalAmount: 1000,
          outlet: { id: "o1", name: "Outlet 1" },
          items: [{ name: "Buff Meat" }],
        },
      ],
      payments: [{ amount: "2000", paymentMethod: "CASH", reference: "partial" }],
    });
    expect(detail).not.toBeNull();
    expect(detail?.totalAmount).toBe(5000);
    expect(detail?.pendingAmount).toBe(3000);
    expect(detail?.orders).toHaveLength(1);
    expect(detail?.orders[0].outlet?.name).toBe("Outlet 1");
    expect(detail?.payments[0].amount).toBe(2000);
    expect(detail?.payments[0].reference).toBe("partial");
  });

  it("parses order and payment defensively", () => {
    expect(parseCreditorOrder({})).not.toBeNull();
    expect(parseCreditorPayment({})).toBeNull();
    expect(parseCreditorPayment({ amount: "x" })).toBeNull();
    expect(parseCreditorPayment({ amount: 100 })!.amount).toBe(100);
  });

  it("requires all creditor form fields", () => {
    expect(
      creditorSchema.safeParse({ name: "", address: "", phone: "" }).success,
    ).toBe(false);
    expect(
      creditorSchema.safeParse({
        name: "A",
        address: "B",
        phone: "1",
      }).success,
    ).toBe(true);
  });
});
