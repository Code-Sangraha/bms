import { z } from "zod";

export const createRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Role name is required")
    .min(2, "Role name must be at least 2 characters")
    .max(100, "Role name must be 100 characters or fewer"),
});

export type CreateRoleFormValues = z.infer<typeof createRoleSchema>;
