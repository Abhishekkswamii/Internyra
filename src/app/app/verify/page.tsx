"use client";

import { useOnline } from "@/lib/pwa/pwa-state";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Link2, MessageSquareText, RotateCw } from "lucide-react";
import { validateUrl } from "@/lib/engine/url";
import { MIN_TEXT_LENGTH } from "@/lib/engine/request";
import { MAX_TEXT_LENGTH } from "@/lib/engine/text";
import { useApi, type Inspection } from "@/lib/inspections-client";

type Mode = "link" | "message";

export default function VerifyPage() {
  const router = useRouter();
  const api = useApi();
  const uid = useId();
  const [mode, setMode] = useState<Mode>("link");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [recruiter, setRecruiter] = useState("");
  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const online = useOnline();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "link") {
      const v = validateUrl(url.trim());
      if (!v.ok) return setError(v.message);
    } else if (text.trim().length < MIN_TEXT_LENGTH) {
      return setError(`Paste at least ${MIN_TEXT_LENGTH} characters so there is something to analyse.`);
    }
    setBusy(true);
    const r = await api<{ inspection: Inspection }>("/api/inspections", {
      method: "POST",
      body: {
        kind: mode,
        ...(mode === "link" ? { url: url.trim() } : { text: text.trim() }),
        claimedCompany: company.trim() || undefined,
        claimedRole: role.trim() || undefined,
        recruiterName: recruiter.trim() || undefined,
        recruiterEmail: recruiterEmail.trim() || undefined,
      },
    });
    if (!r.ok) {
      setError(r.message);
      setBusy(false);
      return;
    }
    router.push(`/app/reports/${encodeURIComponent(r.data.inspection.id)}?start=1`);
  };

  const field = "w-full rounded-lg border border-[var(--border-light)] bg-white px-3 py-2 text-sm text-[var(--ink-primary)] focus:border-[var(--brand-primary)] focus:outline-none";
  const label = "mb-1 block text-xs font-medium text-[var(--ink-secondary)]";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink-primary)] sm:text-3xl">New inspection</h1>
        <p className="mt-1 text-sm text-[var(--ink-secondary)]">Submit an internship link or paste the message you received. The result is saved to your account.</p>
      </div>

      <p className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900" role="note">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Do not submit passwords, one-time codes, bank or card details, government ID numbers or unrelated private content. Paste only the offer or message itself. Internyra never connects to your WhatsApp or other accounts; you paste the text yourself.</span>
      </p>

      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 shadow-xs sm:p-6" noValidate>
        <div role="group" aria-label="What are you checking?" className="inline-flex rounded-full border border-[var(--border-light)] bg-[var(--canvas)] p-1">
          {([["link", "Link", Link2], ["message", "Message or email", MessageSquareText]] as const).map(([m, name, Icon]) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setError(null); }} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${mode === m ? "bg-[var(--ink-primary)] text-white" : "text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />{name}
            </button>
          ))}
        </div>

        {mode === "link" ? (
          <div>
            <label htmlFor={`${uid}-url`} className={label}>Internship or job link</label>
            <input id={`${uid}-url`} type="url" inputMode="url" autoComplete="off" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://company.com/careers/intern" className={field} />
            <p className="mt-1 text-[11px] text-[var(--ink-muted)]">Pages that need a login are not retrieved. If that happens, paste the text instead.</p>
          </div>
        ) : (
          <div>
            <label htmlFor={`${uid}-text`} className={label}>Message, email or job description</label>
            <textarea id={`${uid}-text`} rows={8} maxLength={MAX_TEXT_LENGTH} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the text you received…" className={field} />
            <p className="mt-1 text-[11px] text-[var(--ink-muted)]">{text.length.toLocaleString("en-US")} / {MAX_TEXT_LENGTH.toLocaleString("en-US")}. The pasted text is removed from storage once your report is complete.</p>
          </div>
        )}

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-1 text-xs font-medium text-[var(--ink-secondary)]">Optional details that improve the research</legend>
          <div><label htmlFor={`${uid}-co`} className={label}>Company name</label><input id={`${uid}-co`} value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200} className={field} /></div>
          <div><label htmlFor={`${uid}-role`} className={label}>Role</label><input id={`${uid}-role`} value={role} onChange={(e) => setRole(e.target.value)} maxLength={200} className={field} /></div>
          <div><label htmlFor={`${uid}-rn`} className={label}>Recruiter name</label><input id={`${uid}-rn`} value={recruiter} onChange={(e) => setRecruiter(e.target.value)} maxLength={200} className={field} /></div>
          <div><label htmlFor={`${uid}-re`} className={label}>Recruiter work email</label><input id={`${uid}-re`} type="email" value={recruiterEmail} onChange={(e) => setRecruiterEmail(e.target.value)} maxLength={254} className={field} /></div>
        </fieldset>

        {error && <p role="alert" className="rounded-lg border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-3 text-xs text-[var(--status-risk-text)]">{error}</p>}

        {!online && <p role="status" className="text-xs text-[var(--status-risk-text)]">You&apos;re offline. Reconnect to run an inspection — nothing is analysed offline.</p>}

        <button type="submit" disabled={busy || !online} className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-primary)] disabled:opacity-50">
          {busy && <RotateCw className="h-4 w-4 animate-spin" aria-hidden="true" />}
          <span>{busy ? "Saving…" : "Run inspection"}</span>
        </button>
      </form>
    </div>
  );
}
