import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set to seed the initial administrator.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { email: true },
  });

  if (existingAdmin) {
    console.log("An administrator already exists; seed skipped.");
    return;
  }

  const requiredEnvironment = ["ADMIN_NAME", "ADMIN_EMAIL", "ADMIN_PASSWORD"] as const;
  for (const name of requiredEnvironment) {
    if (!process.env[name]?.trim()) {
      throw new Error(`${name} must be set to seed the initial administrator.`);
    }
  }

  const adminName = process.env.ADMIN_NAME!.trim();
  const adminEmail = process.env.ADMIN_EMAIL!.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD!;

  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error("ADMIN_EMAIL is already assigned to a non-admin user.");
  }

  const userId = randomUUID();
  await prisma.user.create({
    data: {
      id: userId,
      name: adminName,
      email: adminEmail,
      role: "ADMIN",
      accounts: {
        create: {
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          password: await hashPassword(adminPassword),
        },
      },
    },
  });

  console.log("Initial administrator created.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
