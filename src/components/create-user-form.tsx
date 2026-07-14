"use client";

import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function CreateUserForm() {
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
          await axios.post("/api/users", {
            name: formData.get("name"),
            email: formData.get("email"),
            password: formData.get("password"),
            role: formData.get("role"),
          });

          event.currentTarget.reset();
          window.location.reload();
        } catch {
          setError("Unable to create the user right now.");
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
        <label className="text-sm font-medium">Email</label>
        <Input name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Password</label>
        <Input name="password" type="password" minLength={8} required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Role</label>
        <Select name="role" defaultValue="SALES">
          <option value="SALES">Sales</option>
          <option value="ADMIN">Admin</option>
        </Select>
      </div>
      <div className="md:col-span-2 flex justify-end">
        <Button disabled={pending} type="submit">
          {pending ? "Creating..." : "Create user"}
        </Button>
      </div>
      {error ? <div className="md:col-span-2"><ErrorState message={error} /></div> : null}
    </form>
  );
}
