"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { LeadInfoSection } from "@/components/lead-info-section";
import { LeadMetadataCard } from "@/components/lead-metadata-card";
import { NotesPanel } from "@/components/notes-panel";
import { ActivityTimeline } from "@/components/activity-timeline";
import { FollowUpPanel } from "@/components/follow-up-panel";
import { toast } from "@/lib/toast";

type TabId = "info" | "notes" | "activity" | "followups";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "info", label: "General Info" },
  { id: "notes", label: "Notes" },
  { id: "activity", label: "Activity" },
  { id: "followups", label: "Follow-ups" },
];

export function LeadDetailsModal({
  leadId,
  currentUserId,
  isAdmin,
  onClose,
  onUpdate,
}: {
  leadId: string;
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}) {
  const [lead, setLead] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");

  useEffect(() => {
    let cancelled = false;
    axios.get(`/api/leads/${leadId}`).then((res) => {
      if (cancelled) return;
      const data = res.data;
      setLead(data);
      setStatus(data.status);
      setPriority(data.priority);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [leadId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const updateLead = useCallback(async () => {
    setSaving(true);
    try {
      await axios.patch(`/api/leads/${leadId}`, { status, priority });
      toast.success("Lead updated");
      if (onUpdate) onUpdate();
    } catch {
      toast.error("Failed to update lead");
    } finally {
      setSaving(false);
    }
  }, [leadId, status, priority, onUpdate]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 mt-6 mb-6 w-[90%] max-w-4xl flex flex-col bg-white rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden"
        style={{ height: "88vh", maxHeight: "88vh" }}
      >
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-[var(--color-brand)] border-t-transparent rounded-full" />
          </div>
        ) : !lead ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-muted)]">
            Failed to load lead details.
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b border-[var(--color-border)] bg-white">
              <div className="flex items-start justify-between p-5 pb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold truncate">{lead.displayName as string}</h2>
                    <Badge label={status} />
                    <Badge label={priority} />
                  </div>
                  <p className="text-sm text-[var(--color-muted)] mt-0.5">
                    {lead.company as string ?? "No company"}
                    {lead.assignedUser
                      ? ` • Assigned to: ${(lead.assignedUser as Record<string, string>).name}`
                      : ""}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="shrink-0 ml-4 rounded-xl p-2 hover:bg-slate-100 transition"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-2 px-5 pb-3 flex-wrap">
                <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
                  <option value="NEW">New</option>
                  <option value="OPEN">Open</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="ATTEMPTED_CONTACT">Attempted Contact</option>
                  <option value="FOLLOW_UP_SCHEDULED">Follow Up Scheduled</option>
                  <option value="INTERESTED">Interested</option>
                  <option value="QUALIFIED">Qualified</option>
                  <option value="PROPOSAL_SENT">Proposal Sent</option>
                  <option value="NEGOTIATION">Negotiation</option>
                  <option value="WAITING_FOR_CUSTOMER">Waiting for Customer</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="WON">Won</option>
                  <option value="LOST">Lost</option>
                  <option value="DISQUALIFIED">Disqualified</option>
                  <option value="SPAM">Spam</option>
                  <option value="ARCHIVED">Archived</option>
                </Select>
                <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-40">
                  <option value="VERY_LOW">Very Low</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="VERY_HIGH">Very High</option>
                  <option value="URGENT">Urgent</option>
                  <option value="CRITICAL">Critical</option>
                </Select>
                <Button size="sm" variant="secondary" isLoading={saving} onClick={updateLead}>
                  Update
                </Button>
                <Button size="sm" variant="ghost" isLoading={archiving} onClick={async () => {
                  setArchiving(true);
                  try {
                    const isCurrentlyArchived = lead.isArchived as boolean;
                    await axios.patch(`/api/leads/${leadId}`, { isArchived: !isCurrentlyArchived });
                    setLead({ ...lead, isArchived: !isCurrentlyArchived });
                    toast.success(isCurrentlyArchived ? "Lead unarchived" : "Lead archived");
                    if (onUpdate) onUpdate();
                  } catch {
                    toast.error("Failed to update archive status");
                  } finally {
                    setArchiving(false);
                  }
                }}>
                  {(lead.isArchived as boolean) ? "Unarchive" : "Archive"}
                </Button>
              </div>

              <div className="flex border-t border-[var(--color-border)]">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-5 py-2.5 text-sm font-semibold transition border-b-2 ${
                      activeTab === tab.id
                        ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                        : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === "info" && (
                <div className="space-y-5">
                  <LeadInfoSection lead={lead as Parameters<typeof LeadInfoSection>[0]["lead"]} />
                  <LeadMetadataCard lead={lead as Parameters<typeof LeadMetadataCard>[0]["lead"]} />
                </div>
              )}
              {activeTab === "notes" && (
                <NotesPanel leadId={leadId} currentUserId={currentUserId} isAdmin={isAdmin} />
              )}
              {activeTab === "activity" && (
                <ActivityTimeline leadId={leadId} />
              )}
              {activeTab === "followups" && (
                <FollowUpPanel leadId={leadId} currentUserId={currentUserId} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
