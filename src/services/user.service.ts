import { prisma } from "@/lib/prisma";
import { containsSearch, dateRange, listResult, pagination, parseListQuery } from "@/lib/query-builder";

export class UserService {
  async list() {
    return prisma.user.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        salesPrivilege: true,
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
    const where: Record<string, unknown> = {
      isDeleted: query.filters.deleted?.includes("true") ?? false,
    };

    if (query.filters.role?.length) {
      where.role = { in: query.filters.role };
    }
    if (query.filters.salesPrivilege?.length) {
      where.salesPrivilege = query.filters.salesPrivilege[0];
    }
    if (query.filters.active?.length) {
      const val = query.filters.active[0];
      if (val === "true") where.active = true;
      else if (val === "false") where.active = false;
    }
    const searchFilter = containsSearch(["name", "email", "employeeCode"], query.search);
    if (searchFilter) where.OR = searchFilter.OR;
    const dateFilter = dateRange("createdAt", query);
    if (dateFilter) Object.assign(where, dateFilter);

    const orderBy: Record<string, "asc" | "desc">[] = [];
    if (query.sortBy === "name") {
      orderBy.push({ name: query.sortDirection });
    } else if (query.sortBy === "lastSeenAt") {
      orderBy.push({ lastSeenAt: query.sortDirection });
    } else {
      orderBy.push({ createdAt: query.sortDirection });
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        ...pagination(query),
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          salesPrivilege: true,
          active: true,
          createdAt: true,
          lastLoginAt: true,
          lastSeenAt: true,
          _count: { select: { assignedLeads: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const mapped = data.map(({ _count, ...user }) => ({
      ...user,
      assignedLeads: _count.assignedLeads,
    }));

    return listResult(mapped, total, query);
  }

  async markCreated(id: string, createdById: string) {
    return prisma.user.update({ where: { id }, data: { createdById } });
  }
}

export const userService = new UserService();
