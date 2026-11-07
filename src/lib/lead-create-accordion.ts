export type LeadCreateAccordionSection = "leadInformation" | "classification" | "interaction";

const fieldTargets: Record<string, { section: LeadCreateAccordionSection; elementId: string }> = {
  name: { section: "leadInformation", elementId: "lead-name" },
  company: { section: "leadInformation", elementId: "lead-company" },
  email: { section: "leadInformation", elementId: "lead-email" },
  phone: { section: "leadInformation", elementId: "lead-phone" },
  city: { section: "leadInformation", elementId: "lead-city" },
  state: { section: "leadInformation", elementId: "lead-state" },
  requirement: { section: "leadInformation", elementId: "lead-requirement" },
  status: { section: "classification", elementId: "lead-status" },
  priority: { section: "classification", elementId: "lead-priority" },
  category: { section: "classification", elementId: "lead-category" },
  sourceId: { section: "classification", elementId: "lead-source" },
  assignedUserId: { section: "classification", elementId: "lead-assigned" },
  action: { section: "interaction", elementId: "initial-activity-action" },
  response: { section: "interaction", elementId: "initial-activity-response" },
  interest: { section: "interaction", elementId: "initial-activity-interest" },
  followUpDate: { section: "interaction", elementId: "initial-activity-follow-up-date" },
  followUpTime: { section: "interaction", elementId: "initial-activity-follow-up-time" },
};

export function getLeadCreateValidationTarget(issues: readonly { path: readonly PropertyKey[] }[]) {
  const sections = new Set<LeadCreateAccordionSection>();
  let firstElementId: string | null = null;

  for (const issue of issues) {
    const root = issue.path[0];
    const field = root === "initialActivity" ? issue.path[1] : root;
    if (typeof field !== "string") continue;
    const target = fieldTargets[field];
    if (!target) continue;
    sections.add(target.section);
    firstElementId ??= target.elementId;
  }

  return { sections: [...sections], firstElementId };
}
