"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { LEAD_STATUSES, LEAD_PRIORITIES, LEAD_CATEGORIES } from "@/lib/lead-constants";

export type LeadFormData = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  product: string | null;
  requirement: string | null;
  status: string;
  priority: string;
  category: string | null;
  assignedUserId: string | null;
};

export function LeadEditModal({
  open,
  onClose,
  lead,
  assignableUsers,
}: {
  open: boolean;
  onClose: () => void;
  lead?: LeadFormData | null;
  assignableUsers?: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const isEdit = !!lead;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [product, setProduct] = useState("");
  const [requirement, setRequirement] = useState("");
  const [status, setStatus] = useState("NEW");
  const [priority, setPriority] = useState("MEDIUM");
  const [category, setCategory] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setName(lead.name);
      setCompany(lead.company ?? "");
      setEmail(lead.email ?? "");
      setPhone(lead.phone ?? "");
      setCity(lead.city ?? "");
      setState(lead.state ?? "");
      setProduct(lead.product ?? "");
      setRequirement(lead.requirement ?? "");
      setStatus(lead.status);
      setPriority(lead.priority);
      setCategory(lead.category ?? "");
      setAssignedUserId(lead.assignedUserId ?? "");
    } else {
      setName("");
      setCompany("");
      setEmail("");
      setPhone("");
      setCity("");
      setState("");
      setProduct("");
      setRequirement("");
      setStatus("NEW");
      setPriority("MEDIUM");
      setCategory("");
      setAssignedUserId("");
    }
    setError(null);
  }, [open, lead]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        name,
        company: company || null,
        email: email || null,
        phone: phone || null,
        city: city || null,
        state: state || null,
        product: product || null,
        requirement: requirement || null,
        status,
        priority,
        category: category || null,
      };

      if (assignableUsers) {
        payload.assignedUserId = assignedUserId || null;
      }

      if (isEdit) {
        await axios.patch(`/api/leads/${lead.id}`, payload);
      } else {
        await axios.post("/api/leads", payload);
      }

      onClose();
      router.refresh();
    } catch {
      setError(isEdit ? "Failed to update lead." : "Unable to create the lead right now.");
    } finally {
      setPending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative z-10 mt-6 mb-6 w-[90%] max-w-4xl flex flex-col bg-white rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden"
        style={{ height: "88vh", maxHeight: "88vh" }}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">
            {isEdit ? "Edit Lead" : "Create Lead"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-ink)] transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] mb-3">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Name" htmlFor="lead-name" required className="col-span-2">
                  <Input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </FormField>
                <FormField label="Company" htmlFor="lead-company">
                  <Input id="lead-company" value={company} onChange={(e) => setCompany(e.target.value)} />
                </FormField>
              </div>
            </div>

            <hr className="border-[var(--color-border)]" />

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] mb-3">Classification &amp; Assignment</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Status" htmlFor="lead-status">
                  <Select id="lead-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {LEAD_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Priority" htmlFor="lead-priority">
                  <Select id="lead-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                    {LEAD_PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Category" htmlFor="lead-category">
                  <Select id="lead-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">None</option>
                    {LEAD_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </Select>
                </FormField>
                {assignableUsers && (
                  <FormField label="Assigned To" htmlFor="lead-assigned">
                    <Select id="lead-assigned" value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)}>
                      <option value="">Unassigned</option>
                      {assignableUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </Select>
                  </FormField>
                )}
              </div>
            </div>

            <hr className="border-[var(--color-border)]" />

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] mb-3">Contact &amp; Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Email" htmlFor="lead-email">
                  <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </FormField>
                <FormField label="Phone" htmlFor="lead-phone">
                  <Input id="lead-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </FormField>
                <FormField label="City" htmlFor="lead-city">
                  <Input id="lead-city" value={city} onChange={(e) => setCity(e.target.value)} />
                </FormField>
                <FormField label="State" htmlFor="lead-state">
                  <Input id="lead-state" value={state} onChange={(e) => setState(e.target.value)} />
                </FormField>
                <FormField label="Product" htmlFor="lead-product">
                  <Input id="lead-product" value={product} onChange={(e) => setProduct(e.target.value)} />
                </FormField>
                <FormField label="Requirement" htmlFor="lead-requirement" className="col-span-2">
                  <Textarea id="lead-requirement" value={requirement} onChange={(e) => setRequirement(e.target.value)} rows={3} />
                </FormField>
              </div>
            </div>

            {error ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>
            ) : null}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" isLoading={pending}>
                {pending ? "Saving..." : isEdit ? "Save Changes" : "Create Lead"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
