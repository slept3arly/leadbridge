export type SortDirection = "asc" | "desc";

export type ListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDirection: SortDirection;
  filters: Record<string, string[]>;
  dateFrom?: Date;
  dateTo?: Date;
};

const integer = (value: string | null, fallback: number, min: number, max: number) => {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
};

export function parseListQuery(
  searchParams: URLSearchParams,
  options: { defaultPageSize?: number; maxPageSize?: number } = {},
): ListQuery {
  const maxPageSize = options.maxPageSize ?? 100;
  const filters: Record<string, string[]> = {};

  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("filter.") && value) {
      filters[key.slice("filter.".length)] = value.split(",").filter(Boolean);
    }
  }

  const dateFrom = searchParams.get("dateFrom") || filters.dateFrom?.[0] || null;
  const dateTo = searchParams.get("dateTo") || filters.dateTo?.[0] || null;
  delete filters.dateFrom;
  delete filters.dateTo;

  return {
    page: integer(searchParams.get("page"), 1, 1, Number.MAX_SAFE_INTEGER),
    pageSize: integer(searchParams.get("pageSize"), options.defaultPageSize ?? 25, 1, maxPageSize),
    search: searchParams.get("search")?.trim() || undefined,
    sortBy: searchParams.get("sortBy") || undefined,
    sortDirection: searchParams.get("sortDirection") === "asc" ? "asc" : "desc",
    filters,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
  };
}

export function toSearchParams(value: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(value)) {
    if (Array.isArray(raw)) raw.forEach((item) => params.append(key, item));
    else if (raw !== undefined) params.set(key, raw);
  }
  return params;
}

export function pagination(query: Pick<ListQuery, "page" | "pageSize">) {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export function containsSearch(fields: string[], search?: string) {
  if (!search) return undefined;
  return { OR: fields.map((field) => ({ [field]: { contains: search, mode: "insensitive" } })) };
}

export function dateRange(field: string, query: Pick<ListQuery, "dateFrom" | "dateTo">) {
  if (!query.dateFrom && !query.dateTo) return undefined;
  return {
    [field]: {
      ...(query.dateFrom ? { gte: query.dateFrom } : {}),
      ...(query.dateTo ? { lte: query.dateTo } : {}),
    },
  };
}

export function listResult<T>(data: T[], total: number, query: Pick<ListQuery, "page" | "pageSize">) {
  return {
    data,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}
