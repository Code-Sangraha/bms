import { z } from "zod";

export const createRoleSchema = z.object({
  name: z
    .string()
    .min(1, "Role name is required")
    .max(200, "Role name is too long"),
});

export type CreateRoleFormValues = z.infer<typeof createRoleSchema>;
