import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProcessedInventoryHistory } from "@/lib/api/processedInventoryHistory";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(axios.get);

function historyRow(overrides: Record<string, unknown>) {
  return {
    id: "row",
    productId: "product-a",
    type: "RESTOCK",
    weight: 10,
    quantity: null,
    createdAt: "2026-05-17T01:00:00.000Z",
    product: { name: "Product A", weight: 10, DualPricing: [] },
    ...overrides,
  };
}

describe("getProcessedInventoryHistory", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("keeps only rows matching the requested product, type, and date range when the API over-returns", async () => {
    mockedGet.mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        data: [
          historyRow({ id: "chicken-restock", productId: "chicken-wings", type: "RESTOCK" }),
          historyRow({ id: "chicken-sale", productId: "chicken-wings", type: "SALE" }),
          historyRow({ id: "pork-restock", productId: "pork-ribs", type: "RESTOCK" }),
          historyRow({
            id: "old-chicken-restock",
            productId: "chicken-wings",
            type: "RESTOCK",
            createdAt: "2026-05-10T01:00:00.000Z",
          }),
        ],
      },
    });

    const result = await getProcessedInventoryHistory({
      productId: "chicken-wings",
      type: "RESTOCK",
      fromDate: "2026-05-17",
      toDate: "2026-05-17",
    });

    expect(result).toEqual({
      ok: true,
      data: [
        expect.objectContaining({
          id: "chicken-restock",
          productId: "chicken-wings",
          type: "RESTOCK",
        }),
      ],
    });
    expect(mockedGet).toHaveBeenCalledWith(
      expect.stringMatching(/\/products\/processed\/history$/),
      expect.objectContaining({
        data: {
          productId: "chicken-wings",
          type: "RESTOCK",
          fromDate: "2026-05-17",
          toDate: "2026-05-17",
        },
      })
    );
  });
});
