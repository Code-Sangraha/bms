import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOutletExpenses } from "./outletExpenses";

vi.mock("axios", () => ({ default: { get: vi.fn() } }));
const mockedGet = vi.mocked(axios.get);

describe("outlet expense normalization", () => {
  beforeEach(() => mockedGet.mockReset());
  it("accepts any 2xx response and keeps createdAt", async () => {
    mockedGet.mockResolvedValueOnce({ status: 206, data: { success: true, data: [{ id: "expense-1", outletId: "outlet-1", outlet: { id: "outlet-1", name: "Main" }, livestockItemId: "item-1", livestockItem: { id: "item-1", name: "Goat" }, supplierName: "Supplier", supplierContact: null, totalAmount: 100, paidAmount: 40, dueAmount: 60, paymentStatus: "PARTIAL", remarks: null, createdBy: null, createdAt: "2026-07-19T04:00:00.000Z" }] } });
    await expect(getOutletExpenses()).resolves.toMatchObject({ ok: true, data: [{ id: "expense-1", createdAt: "2026-07-19T04:00:00.000Z" }] });
  });
});