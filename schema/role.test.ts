import { describe, expect, it } from "vitest";
import { createRoleSchema } from "@/schema/role";

describe("createRoleSchema", () => {
  it("requires at least two trimmed characters", () => {
    expect(createRoleSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createRoleSchema.safeParse({ name: " A " }).success).toBe(false);
    expect(createRoleSchema.safeParse({ name: " HR " }).success).toBe(true);
  });

  it("rejects names longer than 100 characters", () => {
    expect(createRoleSchema.safeParse({ name: "a".repeat(100) }).success).toBe(true);
    expect(createRoleSchema.safeParse({ name: "a".repeat(101) }).success).toBe(false);
  });
});
