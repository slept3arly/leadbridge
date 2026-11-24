"use client";

import { RecordProgressForm, type ProgressFollowUp } from "@/components/leads/record-progress-form";

type LeadClassification = { status: string; priority: string };

export function RecordProgressModal({
  open,
  leadId,
  leadName,
  lead,
  pendingFollowUps,
  initialFollowUpSchedule,
  onClose,
  onSaved,
}: {
  open: boolean;
  leadId: string;
  leadName?: string;
  lead?: LeadClassification | null;
  pendingFollowUps?: ProgressFollowUp[];
  /** Retained for callers that open the modal from Tasks; existing tasks remain read-only here. */
  initialFollowUpId?: string;
  initialFollowUpSchedule?: { date: string; time: string } | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  return (
    <RecordProgressForm
      mode="standalone"
      open={open}
      leadId={leadId}
      leadName={leadName}
      lead={lead}
      pendingFollowUps={pendingFollowUps}
      initialFollowUpSchedule={initialFollowUpSchedule}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
