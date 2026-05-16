import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLivestockInventoryHistory } from "@/lib/api/livestockInventoryHistory";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(axios.get);

function historyRow(overrides: Record<string, unknown>) {
  return {
    id: "row",
    livestockItemId: "livestock-a",
    type: "RESTOCK",
    quantity: 10,
    weight: null,
    createdAt: "2026-05-17T01:00:00.000Z",
    livestockItem: { id: "livestock-a", name: "Goat A", weight: 10, quantity: 10 },
    ...overrides,
  };
}

describe("getLivestockInventoryHistory", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("keeps only rows matching the requested livestock item, type, and date range when the API over-returns", async () => {
    mockedGet.mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        data: [
          historyRow({ id: "goat-restock", livestockItemId: "goat-1", type: "RESTOCK" }),
          historyRow({ id: "goat-deduct", livestockItemId: "goat-1", type: "DEDUCT" }),
          historyRow({ id: "sheep-restock", livestockItemId: "sheep-1", type: "RESTOCK" }),
          historyRow({
            id: "old-goat-restock",
            livestockItemId: "goat-1",
            type: "RESTOCK",
            createdAt: "2026-05-10T01:00:00.000Z",
          }),
        ],
      },
    });

    const result = await getLivestockInventoryHistory({
      livestockItemId: "goat-1",
      type: "RESTOCK",
      fromDate: "2026-05-17",
      toDate: "2026-05-17",
    });

    expect(result).toEqual({
      ok: true,
      data: [
        expect.objectContaining({
          id: "goat-restock",
          livestockItemId: "goat-1",
          type: "RESTOCK",
        }),
      ],
    });
    expect(mockedGet).toHaveBeenCalledWith(
      expect.stringMatching(/\/products\/livestock\/history$/),
      expect.objectContaining({
        data: {
          livestockItemId: "goat-1",
          type: "RESTOCK",
          fromDate: "2026-05-17",
          toDate: "2026-05-17",
        },
      })
    );
  });

  it("maps the CONSUMED filter to outbound livestock movements only", async () => {
    mockedGet.mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        data: [
          historyRow({ id: "goat-restock", livestockItemId: "goat-1", type: "RESTOCK" }),
          historyRow({ id: "goat-deduct", livestockItemId: "goat-1", type: "DEDUCT" }),
          historyRow({ id: "goat-sale", livestockItemId: "goat-1", type: "SALE" }),
          historyRow({ id: "goat-processing", livestockItemId: "goat-1", type: "SENT_TO_PROCESSING" }),
          historyRow({ id: "sheep-deduct", livestockItemId: "sheep-1", type: "DEDUCT" }),
        ],
      },
    });

    const result = await getLivestockInventoryHistory({
      livestockItemId: "goat-1",
      type: "CONSUMED",
      fromDate: "2026-05-17",
      toDate: "2026-05-17",
    });

    expect(result).toEqual({
      ok: true,
      data: [
        expect.objectContaining({ id: "goat-deduct", type: "DEDUCT" }),
        expect.objectContaining({ id: "goat-sale", type: "SALE" }),
        expect.objectContaining({ id: "goat-processing", type: "SENT_TO_PROCESSING" }),
      ],
    });
  });
});
