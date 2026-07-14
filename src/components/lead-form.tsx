"use client";

import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
      <div className="space-y-2">
        <label className="text-sm font-medium">Name</label>
        <Input name="name" required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Company</label>
        <Input name="company" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Email</label>
        <Input name="email" type="email" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Phone</label>
        <Input name="phone" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">City</label>
        <Input name="city" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">State</label>
        <Input name="state" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Product</label>
        <Input name="product" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Status</label>
        <Select name="status" defaultValue="NEW">
          <option value="NEW">NEW</option>
          <option value="CONTACTED">CONTACTED</option>
          <option value="QUALIFIED">QUALIFIED</option>
          <option value="WON">WON</option>
          <option value="LOST">LOST</option>
        </Select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <label className="text-sm font-medium">Requirement</label>
        <Textarea name="requirement" rows={4} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Priority</label>
        <Select name="priority" defaultValue="MEDIUM">
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="URGENT">URGENT</option>
        </Select>
      </div>
      <div className="flex items-end justify-end">
        <Button disabled={pending} type="submit">
          {pending ? "Saving..." : "Create lead"}
        </Button>
      </div>
      {error ? <div className="md:col-span-2"><ErrorState message={error} /></div> : null}
    </form>
  );
}
