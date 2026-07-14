import { z } from "zod";

const optionalString = (max: number) =>
  z
    .string()
    .max(max)
    .trim()
    .optional()
    .nullable()
    .transform((value) => value || null);

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const leadSchema = z.object({
  name: z.string().min(2).max(120),
  company: optionalString(120),
  email: z.email().optional().nullable().transform((value) => value || null),
  phone: optionalString(30),
  alternatePhone: optionalString(30),
  address: optionalString(180),
  city: optionalString(80),
  state: optionalString(80),
  country: optionalString(80),
  product: optionalString(120),
  requirement: optionalString(2000),
  sourceId: z.string().optional().nullable(),
  sourceReferenceId: optionalString(120),
  assignedUserId: z.string().optional().nullable(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
});

export const userSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.email(),
  password: z.string().min(8).max(128),
  role: z.enum(["ADMIN", "SALES"]),
});

export const settingSchema = z.object({
  key: z.string().min(2).max(80),
  value: z.record(z.string(), z.unknown()),
});
