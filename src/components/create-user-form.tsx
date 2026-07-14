"use client";

import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";

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
      <FormField label="Name" htmlFor="user-name" required>
        <Input id="user-name" name="name" required />
      </FormField>
      <FormField label="Email" htmlFor="user-email" required>
        <Input id="user-email" name="email" type="email" required />
      </FormField>
      <FormField label="Password" htmlFor="user-password" required>
        <Input id="user-password" name="password" type="password" minLength={8} required />
      </FormField>
      <FormField label="Role" htmlFor="user-role">
        <Select id="user-role" name="role" defaultValue="SALES">
          <option value="SALES">Sales</option>
          <option value="ADMIN">Admin</option>
        </Select>
      </FormField>
      <div className="md:col-span-2 flex justify-end">
        <Button isLoading={pending} type="submit">
          {pending ? "Creating..." : "Create user"}
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
