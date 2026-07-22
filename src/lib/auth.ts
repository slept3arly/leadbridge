import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  plugins: [
    admin({
      defaultRole: "SALES" as const,
      adminRoles: ["ADMIN"] as const,
      roles: {
        ADMIN: adminAc,
        SALES: userAc,
      },
    }),
  ],
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await prisma.user.update({
            where: { id: session.userId as string },
            data: { lastLoginAt: new Date() },
          });
        },
      },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "SALES",
        input: false,
      },
      active: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
      banned: {
        type: "boolean",
        required: true,
        defaultValue: false,
        input: false,
      },
      banReason: {
        type: "string",
        required: false,
        input: false,
      },
      banExpires: {
        type: "date",
        required: false,
        input: false,
      },
      salesPrivilege: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
  session: {
    additionalFields: {
      impersonatedBy: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
});
