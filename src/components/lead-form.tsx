"use client";

import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { LEAD_STATUSES } from "@/lib/lead-constants";

export function LeadForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);

        const formData = new FormData(event.currentTarget);

        try {
          await axios.post("/api/leads", {
            name: formData.get("name"),
            company: formData.get("company") || null,
            email: formData.get("email") || null,
            phone: formData.get("phone") || null,
            city: formData.get("city") || null,
            state: formData.get("state") || null,
            product: formData.get("product") || null,
            requirement: formData.get("requirement") || null,
            status: formData.get("status"),
            priority: formData.get("priority"),
          });

          event.currentTarget.reset();
          window.location.reload();
        } catch {
          setError("Unable to create the lead right now.");
        } finally {
          setPending(false);
        }
      }}
    >
      <FormField label="Name" htmlFor="lead-name" required>
        <Input id="lead-name" name="name" required />
      </FormField>
      <FormField label="Company" htmlFor="lead-company">
        <Input id="lead-company" name="company" />
      </FormField>
      <FormField label="Email" htmlFor="lead-email">
        <Input id="lead-email" name="email" type="email" />
      </FormField>
      <FormField label="Phone" htmlFor="lead-phone">
        <Input id="lead-phone" name="phone" />
      </FormField>
      <FormField label="City" htmlFor="lead-city">
        <Input id="lead-city" name="city" />
      </FormField>
      <FormField label="State" htmlFor="lead-state">
        <Input id="lead-state" name="state" />
      </FormField>
      <FormField label="Product" htmlFor="lead-product">
        <Input id="lead-product" name="product" />
      </FormField>
      <FormField label="Status" htmlFor="lead-status">
        <Select id="lead-status" name="status" defaultValue="NEW">
          {LEAD_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label.toUpperCase()}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Requirement" htmlFor="lead-requirement" className="md:col-span-2">
        <Textarea id="lead-requirement" name="requirement" rows={4} />
      </FormField>
      <FormField label="Priority" htmlFor="lead-priority">
        <Select id="lead-priority" name="priority" defaultValue="MEDIUM">
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="URGENT">URGENT</option>
        </Select>
      </FormField>
      <div className="flex items-end justify-end">
        <Button isLoading={pending} type="submit">
          {pending ? "Saving..." : "Create lead"}
        </Button>
      </div>
      {error ? (
        <div className="md:col-span-2">
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>
        </div>
      ) : null}
    </form>
  );
}
