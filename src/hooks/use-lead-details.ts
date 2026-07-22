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

export type LeadActivity = {
  id: string;
  type: string;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
};

export type LeadFollowUp = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: string;
  status: string;
  assignedUser: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  createdAt: string;
};

export type LeadDetails = {
  lead: LeadDetail;
  notes: LeadNote[];
  activities: LeadActivity[];
  followUps: LeadFollowUp[];
};

export function useLeadDetails(leadId: string) {
  const [data, setData] = useState<LeadDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await axios.get<LeadDetails>(`/api/leads/${leadId}/details`);
    setData(res.data);
  }, [leadId]);

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

  return { data, loading, refresh, setData };
}
