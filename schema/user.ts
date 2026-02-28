import { z } from "zod";

export const createUserSchema = z.object({
  fullName: z
    .string()
    .min(1, "Full name is required")
    .max(200, "Full name is too long"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  roleId: z.string().min(1, "Role is required"),
  status: z.enum(["Active", "Inactive"]),
  contact: z.string().max(50, "Contact is too long").optional(),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;
