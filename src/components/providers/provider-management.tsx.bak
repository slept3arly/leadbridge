"use client";

import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Provider = { id: string; name: string };
type Parser = { key: string; name: string; type: string; version: string; description: string };
type ParserManifest = { key: string; name: string; version: string; description: string; providerTypesSupported: string[]; supportsAttachments: boolean; developerNotes: string };
type Rule = { id: string; name: string; priority: number; active: boolean; provider: Provider; parser: { name: string } };

export function ProviderManagement({
  providers,
  parsers,
  parserManifests,
  rules,
}: {
  providers: Provider[];
  parsers: Parser[];
  parserManifests: ParserManifest[];
  rules: Rule[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [providerName, setProviderName] = useState("");
  const [providerSlug, setProviderSlug] = useState("");
  const [providerType, setProviderType] = useState("MANUAL");
  const [ruleName, setRuleName] = useState("");
  const [ruleProvider, setRuleProvider] = useState(providers[0]?.id ?? "");
  const [ruleParser, setRuleParser] = useState(parsers[0]?.key ?? "");
  const [ruleRecipient, setRuleRecipient] = useState("");
  const [ruleSender, setRuleSender] = useState("");
  const [senderDomain, setSenderDomain] = useState("");
  const [subject, setSubject] = useState("");
  const [rulePriority, setRulePriority] = useState("100");

  async function createProvider() {
    await axios.post("/api/providers", { name: providerName, slug: providerSlug, sourceType: providerType });
    window.location.reload();
  }

  async function createRule() {
    const body: Record<string, unknown> = {
      name: ruleName,
      providerId: ruleProvider,
      parserId: ruleParser,
      priority: Number(rulePriority) || 100,
      senderDomain: senderDomain || null,
      subjectContains: subject || null,
    };
    if (ruleRecipient) body.recipientGmailAccount = ruleRecipient;
    if (ruleSender) body.senderEmail = ruleSender;
    await axios.post("/api/providers/routing-rules", body);
    window.location.reload();
  }

  function badge(label: string, color: "green" | "red" | "yellow" | "gray" | "blue") {
    const colors: Record<string, string> = {
      green: "bg-green-100 text-green-700",
      red: "bg-red-100 text-red-700",
      yellow: "bg-yellow-100 text-yellow-700",
      gray: "bg-gray-100 text-gray-600",
      blue: "bg-blue-100 text-blue-700",
    };
    return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${colors[color] ?? colors.gray}`}>{label}</span>;
  }

  return <div className="space-y-6">
    {message ? <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm">{message}</p> : null}

    <Card>
      <h2 className="text-lg font-semibold">Available parsers</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">Parsers auto-discovered from the codebase. No registration required.</p>
      {parserManifests.length ? <div className="mt-4 space-y-3">{parserManifests.map((p) => <div key={p.key} className="border-t pt-3 text-sm"><div className="flex items-start justify-between"><div><p className="font-semibold">{p.name} <span className="font-normal text-[var(--color-muted)]">v{p.version}</span></p><p className="text-[var(--color-muted)]">{p.description || "No description"}</p></div>{badge("Active", "green")}</div><div className="mt-1 flex gap-4 text-xs text-[var(--color-muted)]"><span>Key: {p.key}</span>{p.supportsAttachments ? <span>Supports attachments</span> : null}{p.providerTypesSupported.length ? <span>Providers: {p.providerTypesSupported.join(", ")}</span> : null}</div>{p.developerNotes ? <p className="mt-1 text-xs italic text-[var(--color-muted)]">{p.developerNotes}</p> : null}</div>)}</div> : <p className="pt-3 text-sm text-[var(--color-muted)]">No parsers registered.</p>}
    </Card>

    <Card>
      <h2 className="text-lg font-semibold">Create provider</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">Providers are business vendors. Credentials remain environment-managed.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Input placeholder="Provider name" value={providerName} onChange={(event) => setProviderName(event.target.value)} />
        <Input placeholder="slug" value={providerSlug} onChange={(event) => setProviderSlug(event.target.value)} />
        <Input placeholder="Source type" value={providerType} onChange={(event) => setProviderType(event.target.value)} />
      </div>
      <Button className="mt-3" onClick={createProvider} disabled={!providerName || !providerSlug}>Create provider</Button>
    </Card>

    <Card>
      <h2 className="text-lg font-semibold">Routing rules</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">Incoming messages are matched against rules in priority order. The first match wins.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-6">
        <Input placeholder="Rule name" value={ruleName} onChange={(event) => setRuleName(event.target.value)} />
        <Select value={ruleProvider} onChange={(event) => setRuleProvider(event.target.value)}>
          {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
        </Select>
        <Select value={ruleParser} onChange={(event) => setRuleParser(event.target.value)}>
          {parsers.map((parser) => <option key={parser.key} value={parser.key}>{parser.name} ({parser.version})</option>)}
        </Select>
        <Input placeholder="Recipient" value={ruleRecipient} onChange={(event) => setRuleRecipient(event.target.value)} />
        <Input placeholder="Sender email" value={ruleSender} onChange={(event) => setRuleSender(event.target.value)} />
        <Input placeholder="Sender domain" value={senderDomain} onChange={(event) => setSenderDomain(event.target.value)} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Input placeholder="Subject contains" value={subject} onChange={(event) => setSubject(event.target.value)} />
        <Input placeholder="Priority (0-10000)" value={rulePriority} onChange={(event) => setRulePriority(event.target.value)} />
      </div>
      <Button className="mt-3" onClick={createRule} disabled={!ruleName || !ruleProvider || !ruleParser}>Create rule</Button>
      {rules.length ? <div className="mt-4 space-y-2">{rules.map((rule) => <div key={rule.id} className="flex justify-between border-t pt-2 text-sm"><span><strong>{rule.name}</strong> → {rule.provider.name} / {rule.parser.name}</span><span>Priority {rule.priority} · {rule.active ? "Active" : "Inactive"}</span></div>)}</div> : null}
    </Card>
  </div>;
}
