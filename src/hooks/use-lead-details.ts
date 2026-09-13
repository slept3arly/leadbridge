"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";

export type LeadDetail = {
  id: string;
  displayName: string;
  company: string | null;
  status: string;
  priority: string;
  category?: string | null;
  isArchived?: boolean;
  [key: string]: unknown;
};

export type LeadNoteFollowUp = {
  id: string;
  dueDate: string | null;
  dueTime: string | null;
  status: string;
  completedAt: string | null;
};

export type LeadNote = {
  id: string;
  content: string;
  whatIDid: string | null;
  whatCustomerSaid: string | null;
  createdAt: string;
  editedAt: string;
  authorId: string;
  author: { id: string; name: string };
  followUps?: LeadNoteFollowUp[];
};

export type LeadFollowUp = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: string;
  status: string;
  completedAt: string | null;
  noteId: string | null;
  assignedUser: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  createdAt: string;
};

export type ActivityEventEntry = {
  id: string;
  type: string;
  action: "CALL" | "WHATSAPP" | null;
  response: "PICKED_UP" | "NO_RESPONSE" | "INVALID_NUMBER" | "REPLIED" | null;
  interest: "INTERESTED" | "NOT_INTERESTED" | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  followUpId: string | null;
  followUp: {
    id: string;
    title: string;
    dueDate: string | null;
    dueTime: string | null;
    status: string;
    completedAt: string | null;
  } | null;
  createdAt: string;
};

export type ActivityEventItem = {
  id: string;
  type: string;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
  actor: { id: string; name: string } | null;
  entries: ActivityEventEntry[];
};

export type LeadDetails = {
  lead: LeadDetail;
  notes: LeadNote[];
  followUps: LeadFollowUp[];
  activityEvents: ActivityEventItem[];
};

export function useLeadDetails(leadId: string) {
  const [data, setData] = useState<LeadDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await axios.get<LeadDetails>(`/api/leads/${leadId}/details`);
    setData(res.data);
  }, [leadId]);

  const patchData = useCallback((patch: Partial<LeadDetails> | ((prev: LeadDetails | null) => LeadDetails | null)) => {
    if (typeof patch === "function") {
      setData(patch);
    } else {
      setData((prev) => (prev ? { ...prev, ...patch } : prev));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    axios.get<LeadDetails>(`/api/leads/${leadId}/details`)
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const completeFollowUp = useCallback(async (followUpId: string, data: {
    note?: string | null;
    nextFollowUp?: { dueDate: string; dueTime?: string | null } | null;
    activity?: {
      action: "CALL" | "WHATSAPP";
      response: "PICKED_UP" | "NO_RESPONSE" | "INVALID_NUMBER" | "REPLIED";
      interest?: "INTERESTED" | "NOT_INTERESTED" | null;
      notes?: string | null;
    } | null;
  }) => {
    const res = await axios.post(`/api/follow-ups/${followUpId}/complete`, data);
    return res.data as { completedFollowUp: LeadFollowUp; nextFollowUp: LeadFollowUp | null };
  }, []);

  return { data, loading, refresh, setData, patchData, completeFollowUp };
}
