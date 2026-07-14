"use client";

import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Provider = { id: string; name: string };
type Parser = { key: string; name: string; type: string };
type GmailAccount = { key: string; name: string; status: string; missing: string[]; lastSyncedAt: string | null; providerCount: number };
type Rule = { id: string; name: string; priority: number; active: boolean; provider: Provider; parser: { name: string } };
type SyncRun = { id: string; status: string; startedAt: string; completedAt: string | null; recordsCreated: number; recordsUpdated: number; recordsSkipped: number; errorMessage: string | null; connector: { name: string } };
type Unmatched = { id: string; senderEmail: string; subject: string | null; receivedAt: string; rawPreview: string | null; status: string; provider: Provider | null };
type ParserRequest = { id: string; vendorName: string; senderEmail: string; sampleSubject: string | null; status: string; requestedAt: string; requestedBy: { name: string } };

export function ProviderManagement({ providers, parsers, gmailAccounts, rules, syncRuns, unmatched, parserRequests }: { providers: Provider[]; parsers: Parser[]; gmailAccounts: GmailAccount[]; rules: Rule[]; syncRuns: SyncRun[]; unmatched: Unmatched[]; parserRequests: ParserRequest[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [providerName, setProviderName] = useState("");
  const [providerSlug, setProviderSlug] = useState("");
  const [providerType, setProviderType] = useState("MANUAL");
  const [ruleName, setRuleName] = useState("");
  const [ruleProvider, setRuleProvider] = useState(providers[0]?.id ?? "");
  const [ruleParser, setRuleParser] = useState(parsers[0]?.key ?? "");
  const [senderDomain, setSenderDomain] = useState("");
  const [subject, setSubject] = useState("");

  async function createProvider() {
    await axios.post("/api/providers", { name: providerName, slug: providerSlug, sourceType: providerType });
    window.location.reload();
  }

  async function createRule() {
    await axios.post("/api/providers/routing-rules", { name: ruleName, providerId: ruleProvider, parserId: ruleParser, senderDomain: senderDomain || null, subjectContains: subject || null });
    window.location.reload();
  }

  async function testConnection(key: string) {
    const response = await axios.post("/api/providers/connectors/test", { key, kind: "GMAIL" });
    setMessage(response.data.success ? `${key}: configuration is valid.` : `${key}: ${response.data.reason}`);
  }

  async function handleUnmatched(id: string, action: "ASSIGN" | "CREATE_PROVIDER" | "IGNORE" | "SPAM" | "REQUEST_PARSER", providerId?: string) {
    await axios.patch("/api/providers/unmatched", { id, action, providerId });
    window.location.reload();
  }

  return <div className="space-y-6">
    {message ? <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm">{message}</p> : null}
    <Card><h2 className="text-lg font-semibold">Create provider</h2><p className="mt-1 text-sm text-[var(--color-muted)]">Providers are business vendors. Credentials remain environment-managed.</p><div className="mt-4 grid gap-3 md:grid-cols-3"><Input placeholder="Provider name" value={providerName} onChange={(event) => setProviderName(event.target.value)} /><Input placeholder="slug" value={providerSlug} onChange={(event) => setProviderSlug(event.target.value)} /><Input placeholder="Source type" value={providerType} onChange={(event) => setProviderType(event.target.value)} /></div><Button className="mt-3" onClick={createProvider} disabled={!providerName || !providerSlug}>Create provider</Button></Card>
    <Card><h2 className="text-lg font-semibold">Routing rules</h2><div className="mt-4 grid gap-3 md:grid-cols-5"><Input placeholder="Rule name" value={ruleName} onChange={(event) => setRuleName(event.target.value)} /><Select value={ruleProvider} onChange={(event) => setRuleProvider(event.target.value)}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</Select><Select value={ruleParser} onChange={(event) => setRuleParser(event.target.value)}>{parsers.map((parser) => <option key={parser.key} value={parser.key}>{parser.name}</option>)}</Select><Input placeholder="Sender domain" value={senderDomain} onChange={(event) => setSenderDomain(event.target.value)} /><Input placeholder="Subject contains" value={subject} onChange={(event) => setSubject(event.target.value)} /></div><Button className="mt-3" onClick={createRule} disabled={!ruleName || !ruleProvider || !ruleParser}>Create rule</Button>{rules.length ? <div className="mt-4 space-y-2">{rules.map((rule) => <div key={rule.id} className="flex justify-between border-t pt-2 text-sm"><span>{rule.name} → {rule.provider.name} / {rule.parser.name}</span><span>Priority {rule.priority} · {rule.active ? "Active" : "Inactive"}</span></div>)}</div> : null}</Card>
    <Card><h2 className="text-lg font-semibold">Configured Gmail accounts</h2>{gmailAccounts.length ? gmailAccounts.map((account) => <div key={account.key} className="flex items-center justify-between border-t py-3 text-sm"><div><p className="font-semibold">{account.name}</p><p className="text-[var(--color-muted)]">{account.status} · {account.providerCount} providers · Last sync: {account.lastSyncedAt ? new Date(account.lastSyncedAt).toLocaleString() : "Never"}</p>{account.missing.length ? <p className="text-red-600">Missing: {account.missing.join(", ")}</p> : null}</div><Button variant="secondary" onClick={() => testConnection(account.key)}>Test connection</Button></div>) : <p className="pt-3 text-sm text-[var(--color-muted)]">No GMAIL_* environment configurations discovered.</p>}</Card>
    <Card><h2 className="text-lg font-semibold">Sync history</h2>{syncRuns.length ? <div className="space-y-2">{syncRuns.map((run) => <div key={run.id} className="border-t py-3 text-sm"><div className="flex justify-between"><span>{run.connector.name} · {run.status}</span><span>{new Date(run.startedAt).toLocaleString()}</span></div><p className="text-[var(--color-muted)]">Created {run.recordsCreated} · Updated {run.recordsUpdated} · Skipped {run.recordsSkipped}{run.completedAt ? ` · Finished ${new Date(run.completedAt).toLocaleString()}` : ""}</p>{run.errorMessage ? <p className="text-red-600">{run.errorMessage}</p> : null}</div>)}</div> : <p className="pt-3 text-sm text-[var(--color-muted)]">No sync runs recorded.</p>}</Card>
    <Card><h2 className="text-lg font-semibold">Unmatched email queue</h2>{unmatched.length ? unmatched.map((email) => <div key={email.id} className="border-t py-3 text-sm"><p className="font-semibold">{email.senderEmail} · {email.subject ?? "No subject"}</p><p className="text-[var(--color-muted)]">{email.status} · {new Date(email.receivedAt).toLocaleString()}</p>{email.rawPreview ? <Textarea className="mt-2" value={email.rawPreview} readOnly rows={2} /> : null}<div className="mt-2 flex flex-wrap gap-2"><Select defaultValue="" onChange={(event) => event.target.value && handleUnmatched(email.id, "ASSIGN", event.target.value)}><option value="">Assign provider...</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</Select><Button variant="secondary" onClick={() => handleUnmatched(email.id, "CREATE_PROVIDER")}>Create provider</Button><Button variant="secondary" onClick={() => handleUnmatched(email.id, "IGNORE")}>Ignore</Button><Button variant="secondary" onClick={() => handleUnmatched(email.id, "SPAM")}>Spam</Button><Button variant="secondary" onClick={() => handleUnmatched(email.id, "REQUEST_PARSER")}>Request parser</Button></div></div>) : <p className="pt-3 text-sm text-[var(--color-muted)]">No unmatched emails.</p>}</Card>
    <Card><h2 className="text-lg font-semibold">Parser requests</h2>{parserRequests.length ? parserRequests.map((request) => <div key={request.id} className="flex items-center justify-between border-t py-3 text-sm"><span>{request.vendorName} · {request.senderEmail} · {request.sampleSubject ?? "No subject"}</span><span>{request.status} · {request.requestedBy.name}</span></div>) : <p className="pt-3 text-sm text-[var(--color-muted)]">No parser requests.</p>}</Card>
  </div>;
}
