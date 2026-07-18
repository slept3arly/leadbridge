"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type TableQueryState = {
  search: string;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDirection: "asc" | "desc";
  filters: Record<string, string>;
  dateFrom?: string;
  dateTo?: string;
};

const FILTER_KEYS_FROM_URL = ["status", "priority", "category"];

function readFiltersFromUrl(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const filters: Record<string, string> = {};
  for (const key of FILTER_KEYS_FROM_URL) {
    const val = params.get(`filter.${key}`);
    if (val) filters[key] = val;
  }
  return filters;
}

function readUrlParam(key: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  return params.get(key) || undefined;
}

export function useTableQuery(initial: Partial<TableQueryState> = {}, debounceMs = 300) {
  const router = useRouter();
  const [state, setState] = useState<TableQueryState>(() => {
    const urlFilters = readFiltersFromUrl();
    return {
      search: readUrlParam("search") ?? initial.search ?? "",
      page: Number(readUrlParam("page") ?? initial.page ?? 1),
      pageSize: Number(readUrlParam("pageSize") ?? initial.pageSize ?? 25),
      sortBy: readUrlParam("sortBy") ?? initial.sortBy,
      sortDirection: readUrlParam("sortDirection") === "asc" ? "asc" : (initial.sortDirection ?? "desc"),
      filters: { ...initial.filters, ...urlFilters },
      dateFrom: readUrlParam("dateFrom") ?? initial.dateFrom,
      dateTo: readUrlParam("dateTo") ?? initial.dateTo,
    };
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const initialized = useRef(false);

  const update = useCallback((next: Partial<TableQueryState>) => {
    setState((current) => ({ ...current, ...next, ...(next.search === undefined ? {} : { page: 1 }) }));
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (state.search) params.set("search", state.search);
      params.set("page", String(state.page));
      params.set("pageSize", String(state.pageSize));
      if (state.sortBy) params.set("sortBy", state.sortBy);
      params.set("sortDirection", state.sortDirection);
      Object.entries(state.filters).forEach(([key, value]) => {
        if (value) params.set(`filter.${key}`, value);
      });
      if (state.dateFrom) params.set("dateFrom", state.dateFrom);
      if (state.dateTo) params.set("dateTo", state.dateTo);
      router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
    }, state.search === "" ? 0 : debounceMs);
    return () => clearTimeout(timer.current);
  }, [debounceMs, router, state]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (state.search) params.set("search", state.search);
    params.set("page", String(state.page));
    params.set("pageSize", String(state.pageSize));
    if (state.sortBy) params.set("sortBy", state.sortBy);
    params.set("sortDirection", state.sortDirection);
    Object.entries(state.filters).forEach(([key, value]) => {
      if (value) params.set(`filter.${key}`, value);
    });
    if (state.dateFrom) params.set("dateFrom", state.dateFrom);
    if (state.dateTo) params.set("dateTo", state.dateTo);
    return params.toString();
  }, [state]);

  return { ...state, update, queryString };
}
