import { afterEach, describe, expect, it, vi } from "vitest";
import { getLoyaltyRule } from "./sale";
import { parseCustomerForTest } from "./customer";
import { SALES_ROUTES } from "@/lib/api/routes";

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

describe("loyalty and customer contract", () => {
  it("uses the newest loyalty-rule getter alias", () => {
    expect(SALES_ROUTES.LOYALTY_RULE_GET).toBe("/sales/loyalty-rules");
  });

  it("normalizes one loyalty rule object", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          data: { id: "rule-1", minPurchaseKg: "10", rewardKg: 1 },
        }),
      ),
    );

    await expect(getLoyaltyRule()).resolves.toMatchObject({
      ok: true,
      data: { id: "rule-1", minPurchaseKg: 10, rewardKg: 1 },
    });
  });

  it("supports a missing loyalty rule", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true, data: null })));
    await expect(getLoyaltyRule()).resolves.toEqual({ ok: true, data: null });
  });

  it("keeps customers whose fetched outlet is missing", () => {
    expect(
      parseCustomerForTest({
        id: "customer-1",
        name: "Ram",
        contact: "9800000000",
        customerTypeId: "type-1",
        outletId: null,
      }),
    ).toMatchObject({ id: "customer-1", outletId: undefined });
  });
});
