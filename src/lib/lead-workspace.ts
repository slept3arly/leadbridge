import type { ActivityEventItem, LeadFollowUp, LeadNote } from "../hooks/use-lead-details";

export function buildLeadWorkspaceTimeline(events: ActivityEventItem[], notes: LeadNote[]): ActivityEventItem[] {
  const notesById = new Map(notes.map((note) => [note.id, note]));
  const representedNoteIds = new Set<string>();
  const result = events.map((event) => ({
    ...event,
    entries: event.entries.map((entry) => {
      if (entry.type !== "NOTE_ADDED") return entry;
      const noteId = typeof entry.metadata?.noteId === "string" ? entry.metadata.noteId : null;
      const note = noteId ? notesById.get(noteId) : undefined;
      if (!note) return entry;
      representedNoteIds.add(note.id);
      return { ...entry, message: note.content };
    }),
  }));

  for (const note of notes) {
    if (representedNoteIds.has(note.id)) continue;
    result.push({
      id: `legacy-note-${note.id}`,
      type: "NOTE",
      metadata: { noteId: note.id, legacyRecord: true },
      occurredAt: note.createdAt,
      createdAt: note.createdAt,
      actor: note.author,
      entries: [{
        id: `legacy-note-entry-${note.id}`,
        type: "NOTE_ADDED",
        action: null,
        response: null,
        interest: null,
        message: note.content,
        metadata: { legacyRecord: true },
        followUpId: null,
        followUp: null,
        createdAt: note.createdAt,
      }],
    });
  }

  return result.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

export function organizeLeadWorkspaceFollowUps(followUps: LeadFollowUp[], now = new Date()) {
  const pending = followUps.filter((item) => item.status === "PENDING").sort((a, b) => {
    if (!a.dueDate) return b.dueDate ? 1 : 0;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
  const completed = followUps.filter((item) => item.status === "COMPLETED")
    .sort((a, b) => new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime());
  const todayStartUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const overdueIds = new Set(pending.filter((item) => item.dueDate && new Date(item.dueDate) < todayStartUTC).map((item) => item.id));
  return { pending, completed, overdueIds };
}
