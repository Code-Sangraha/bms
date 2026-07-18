import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api/client";
import { ITEM_INVENTORY_ROUTES } from "@/lib/api/routes";
import {
  createInventoryItem,
  getInventoryHistory,
  getInventoryItem,
  updateInventoryUnit,
  updateItemCategory,
} from "./itemInventory";

vi.mock("@/lib/api/client", () => ({
  apiRequest: vi.fn(),
  getApiErrorMessage: (value: { message?: string }) => value.message ?? "Request failed.",
}));
const mockedApiRequest = vi.mocked(apiRequest);

describe("item inventory handlers", () => {
  beforeEach(() => mockedApiRequest.mockReset());

  it("sends the complete create-item payload", async () => {
    mockedApiRequest.mockResolvedValueOnce({ ok: true, data: { success: true, data: null } });
    const payload = { name: "Rice", categoryId: "cat-1", unitId: "unit-1", quantity: 12, buyingPrice: 80, sellingPrice: 95, lowStockAlertQuantity: 3 };
    await createInventoryItem(payload);
    expect(mockedApiRequest).toHaveBeenCalledWith(ITEM_INVENTORY_ROUTES.ITEMS, { method: "POST", body: JSON.stringify(payload) });
  });

  it("keeps a successful null item response", async () => {
    mockedApiRequest.mockResolvedValueOnce({ ok: true, data: { success: true, data: null } });
    await expect(getInventoryItem("missing")).resolves.toEqual({ ok: true, data: null });
  });

  it("sends current category and unit fields with status changes", async () => {
    mockedApiRequest.mockResolvedValue({ ok: true, data: { success: true, data: null } });
    await updateItemCategory({ id: "cat-1", name: " Food ", status: false });
    await updateInventoryUnit({ id: "unit-1", name: " Kilogram ", symbol: " kg ", status: false });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(1, ITEM_INVENTORY_ROUTES.CATEGORIES, { method: "PUT", body: JSON.stringify({ id: "cat-1", name: "Food", status: false }) });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(2, ITEM_INVENTORY_ROUTES.UNITS, { method: "PUT", body: JSON.stringify({ id: "unit-1", name: "Kilogram", symbol: "kg", status: false }) });
  });

  it("only sends supported server-side history parameters", async () => {
    mockedApiRequest.mockResolvedValueOnce({ ok: true, data: { success: true, data: [] } });
    await getInventoryHistory({ itemId: "item-1", from: "2026-07-01T00:00:00.000Z", to: "2026-07-20T00:00:00.000Z" });
    const route = vi.mocked(mockedApiRequest).mock.calls[0][0];
    expect(route).toContain("itemId=item-1");
    expect(route).toContain("from=");
    expect(route).toContain("to=");
    expect(route).not.toContain("page=");
    expect(route).not.toContain("type=");
  });
});