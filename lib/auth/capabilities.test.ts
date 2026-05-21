import { describe, expect, it } from "vitest";
import { getRoleCapabilities } from "@/lib/auth/capabilities";

describe("getRoleCapabilities", () => {
  it("does not allow staff to manually adjust processed inventory storage", () => {
    const capabilities = getRoleCapabilities("Staff");

    expect(capabilities.canViewProcessedInventory).toBe(true);
    expect(capabilities.canRestockProcessedInventory).toBe(false);
    expect(capabilities.canDeductProcessedInventory).toBe(false);
  });
});
