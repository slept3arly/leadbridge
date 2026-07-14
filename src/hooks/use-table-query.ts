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
};

export function useTableQuery(initial: Partial<TableQueryState> = {}, debounceMs = 300) {
  const router = useRouter();
  const [state, setState] = useState<TableQueryState>(() => {
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    return {
      search: params.get("search") ?? initial.search ?? "",
      page: Number(params.get("page") ?? initial.page ?? 1),
      pageSize: Number(params.get("pageSize") ?? initial.pageSize ?? 25),
      sortBy: params.get("sortBy") ?? initial.sortBy,
      sortDirection: params.get("sortDirection") === "asc" ? "asc" : initial.sortDirection ?? "desc",
      filters: initial.filters ?? {},
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
      Object.entries(state.filters).forEach(([key, value]) => value && params.set(`filter.${key}`, value));
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
    Object.entries(state.filters).forEach(([key, value]) => value && params.set(`filter.${key}`, value));
    return params.toString();
  }, [state]);

  return { ...state, update, queryString };
}
