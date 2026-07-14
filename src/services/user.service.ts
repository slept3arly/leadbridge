import { prisma } from "@/lib/prisma";
import { containsSearch, listResult, pagination, parseListQuery } from "@/lib/query-builder";

export class UserService {
  async list() {
    return prisma.user.findMany({
      where: { isDeleted: false },
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
      where: { active: true, isDeleted: false, role: "SALES" },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async stats() {
    const [admins, sales] = await Promise.all([
      prisma.user.count({ where: { role: "ADMIN", active: true, isDeleted: false } }),
      prisma.user.count({ where: { role: "SALES", active: true, isDeleted: false } }),
    ]);

    return { admins, sales };
  }

  async listPage(searchParams: URLSearchParams) {
    const query = parseListQuery(searchParams);
    const where = {
      isDeleted: query.filters.deleted?.includes("true") ?? false,
      ...(query.filters.role?.length ? { role: { in: query.filters.role as ("ADMIN" | "SALES")[] } } : {}),
      ...(query.filters.active?.length ? { active: query.filters.active.includes("true") } : {}),
      ...containsSearch(["name", "email", "employeeCode"], query.search),
    };
    const [data, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { name: "asc" }, ...pagination(query), select: { id: true, name: true, email: true, role: true, active: true, createdAt: true } }),
      prisma.user.count({ where }),
    ]);
    return listResult(data, total, query);
  }

  async markCreated(id: string, createdById: string) {
    return prisma.user.update({ where: { id }, data: { createdById } });
  }
}

export const userService = new UserService();
