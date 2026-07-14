import { prisma } from "@/lib/prisma";

export class UserService {
  async list() {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async listAssignable() {
    return prisma.user.findMany({
      where: { active: true, role: "SALES" },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async stats() {
    const [admins, sales] = await Promise.all([
      prisma.user.count({ where: { role: "ADMIN", active: true } }),
      prisma.user.count({ where: { role: "SALES", active: true } }),
    ]);

    return { admins, sales };
  }
}

export const userService = new UserService();
