"use client";

import { useEffect, useRef } from "react";
import {
  createCrmMutationHandler,
  getLastLocalCrmMutationAt,
  shouldRevalidateOnVisibility,
  subscribeToCrmMutations,
  type CrmEntityType,
  type CrmMutationMessage,
} from "@/lib/crm-sync";

type UseCrmSyncOptions = {
  entityTypes?: readonly CrmEntityType[];
  leadId?: string;
  entityIds?: readonly string[];
  onRefresh: (message?: CrmMutationMessage) => void | Promise<void>;
  visibilityCooldownMs?: number;
};

export function useCrmSync({ entityTypes, leadId, entityIds, onRefresh, visibilityCooldownMs = 30_000 }: UseCrmSyncOptions) {
  const refreshRef = useRef(onRefresh);
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    lastRefreshRef.current = Date.now();
  }, []);

  const entityTypesKey = entityTypes?.join("|") ?? "*";
  const entityIdsKey = entityIds?.join("|") ?? "";

  useEffect(() => {
    const entityTypesFilter = entityTypesKey === "*" ? undefined : entityTypesKey.split("|") as CrmEntityType[];
    const entityIdsFilter = entityIdsKey ? entityIdsKey.split("|") : undefined;
    const handleMutation = createCrmMutationHandler((message) => {
      lastRefreshRef.current = Date.now();
      void Promise.resolve(refreshRef.current(message)).catch(() => {});
    }, { entityTypes: entityTypesFilter, leadId, entityIds: entityIdsFilter });

    return subscribeToCrmMutations(handleMutation);
  }, [entityTypesKey, entityIdsKey, leadId]);

  useEffect(() => {
    const revalidateIfStale = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      const lastRefresh = Math.max(lastRefreshRef.current, getLastLocalCrmMutationAt());
      if (!shouldRevalidateOnVisibility(now, lastRefresh, visibilityCooldownMs)) return;
      lastRefreshRef.current = now;
      void Promise.resolve(refreshRef.current()).catch(() => {});
    };

    document.addEventListener("visibilitychange", revalidateIfStale);
    window.addEventListener("focus", revalidateIfStale);
    return () => {
      document.removeEventListener("visibilitychange", revalidateIfStale);
      window.removeEventListener("focus", revalidateIfStale);
    };
  }, [visibilityCooldownMs]);
}
