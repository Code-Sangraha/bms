import { z } from "zod";

const optionalOutletIdSchema = z
  .union([z.string().uuid("Outlet must be a valid UUID"), z.literal("")])
  .optional();

export const createUserSchema = z.object({
  fullName: z
    .string()
    .min(1, "Full name is required")
    .max(200, "Full name is too long"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  roleId: z.string().min(1, "Role is required"),
  status: z.enum(["Active", "Inactive"]).optional().default("Active"),
  contact: z.string().max(50, "Contact is too long").optional(),
  /** Empty string means no outlet assignment. */
  outletId: optionalOutletIdSchema,
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;
