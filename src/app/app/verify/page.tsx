"use client";

import { useOnline } from "@/lib/pwa/pwa-state";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Link2,
  MessageSquareText,
  RotateCw,
  ShieldCheck,
  Building2,
  Briefcase,
  User,
  Mail,
} from "lucide-react";
import { validateUrl } from "@/lib/engine/url";
import { MIN_TEXT_LENGTH } from "@/lib/engine/request";
import { MAX_TEXT_LENGTH } from "@/lib/engine/text";
import { useApi, type Inspection } from "@/lib/inspections-client";
import { AppPageHeader } from "@/components/ui/AppPageHeader";

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
      return setError(
        `Paste at least ${MIN_TEXT_LENGTH} characters so there is sufficient text to examine.`
      );
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
      setError(r.message || "Failed to submit inspection. Please try again.");
      setBusy(false);
      return;
    }

    router.push(`/app/reports/${encodeURIComponent(r.data.inspection.id)}?start=1`);
  };

  const fieldClasses =
    "w-full rounded-xl border border-[var(--border-light)] bg-white px-3.5 py-2.5 text-xs sm:text-sm text-[var(--ink-primary)] placeholder:[var(--ink-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-glow)] focus:outline-none transition-all";
  const labelClasses = "mb-1 block text-xs font-semibold text-[var(--ink-primary)]";

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <AppPageHeader
        title="New inspection"
        eyebrow="Verification Engine"
        description="Submit an internship opportunity or recruiter message to examine its claims and available evidence."
      />

      {/* Restrained Privacy & Security Notice */}
      <div
        className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-950 leading-relaxed"
        role="note"
      >
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-bold font-mono uppercase tracking-wider text-[11px] text-amber-900">
            Confidentiality notice
          </p>
          <p>
            Never submit passwords, OTPs, bank credentials, ID numbers or unrelated personal information.
            Paste only the offer or message text itself. Internyra never connects to your private messaging
            accounts; you paste the text directly.
          </p>
        </div>
      </div>

      {/* Main Submission Form */}
      <form
        onSubmit={submit}
        className="space-y-6 rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 sm:p-7 shadow-xs"
        noValidate
      >
        {/* Input Selector Tabs */}
        <div className="space-y-2">
          <label className="block text-xs font-mono uppercase font-bold text-[var(--ink-muted)]">
            Opportunity format
          </label>
          <div
            role="group"
            aria-label="What are you checking?"
            className="grid grid-cols-2 rounded-xl border border-[var(--border-light)] bg-[var(--surface-2)] p-1 text-xs font-semibold"
          >
            {(
              [
                ["link", "Internship link", Link2],
                ["message", "Message or email", MessageSquareText],
              ] as const
            ).map(([m, name, Icon]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`inline-flex items-center justify-center gap-2 rounded-lg py-2 transition-all ${
                  mode === m
                    ? "bg-[var(--surface-0)] text-[var(--ink-primary)] shadow-xs font-bold"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Primary Input Panel */}
        {mode === "link" ? (
          <div className="space-y-1.5">
            <label htmlFor={`${uid}-url`} className={labelClasses}>
              Internship or job link <span className="text-[var(--status-risk-text)]">*</span>
            </label>
            <div className="relative">
              <Link2 className="w-4 h-4 text-[var(--ink-muted)] absolute left-3.5 top-3 pointer-events-none" />
              <input
                id={`${uid}-url`}
                type="url"
                inputMode="url"
                autoComplete="off"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://company.com/careers/internship"
                className={`${fieldClasses} pl-10`}
                required
              />
            </div>
            <p className="text-[11px] font-mono text-[var(--ink-muted)]">
              Pages behind sign-in walls cannot be retrieved by automated research. If that happens, select &ldquo;Message or email&rdquo; to paste the description.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor={`${uid}-text`} className={labelClasses}>
                Message or email text <span className="text-[var(--status-risk-text)]">*</span>
              </label>
              <span className="text-[11px] font-mono text-[var(--ink-muted)]">
                {text.length.toLocaleString("en-US")} / {MAX_TEXT_LENGTH.toLocaleString("en-US")}
              </span>
            </div>
            <textarea
              id={`${uid}-text`}
              rows={8}
              maxLength={MAX_TEXT_LENGTH}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the recruiter WhatsApp, Telegram, email or offer letter text here…"
              className={fieldClasses}
              required
            />
            <p className="text-[11px] font-mono text-[var(--ink-muted)]">
              Pasted text is permanently removed from server storage once research finishes. Only evidence findings are preserved.
            </p>
          </div>
        )}

        {/* Context Information Panel (Optional) */}
        <fieldset className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
          <legend className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ink-muted)]">
            Context details (optional)
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-co`} className={labelClasses}>
                Company name
              </label>
              <div className="relative">
                <Building2 className="w-3.5 h-3.5 text-[var(--ink-muted)] absolute left-3 top-3 pointer-events-none" />
                <input
                  id={`${uid}-co`}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Acme Labs"
                  className={`${fieldClasses} pl-9`}
                />
              </div>
            </div>

            <div>
              <label htmlFor={`${uid}-role`} className={labelClasses}>
                Role / Title
              </label>
              <div className="relative">
                <Briefcase className="w-3.5 h-3.5 text-[var(--ink-muted)] absolute left-3 top-3 pointer-events-none" />
                <input
                  id={`${uid}-role`}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Data Analyst Intern"
                  className={`${fieldClasses} pl-9`}
                />
              </div>
            </div>

            <div>
              <label htmlFor={`${uid}-rn`} className={labelClasses}>
                Recruiter name
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-[var(--ink-muted)] absolute left-3 top-3 pointer-events-none" />
                <input
                  id={`${uid}-rn`}
                  value={recruiter}
                  onChange={(e) => setRecruiter(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Jane Doe"
                  className={`${fieldClasses} pl-9`}
                />
              </div>
            </div>

            <div>
              <label htmlFor={`${uid}-re`} className={labelClasses}>
                Recruiter work email
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-[var(--ink-muted)] absolute left-3 top-3 pointer-events-none" />
                <input
                  id={`${uid}-re`}
                  type="email"
                  value={recruiterEmail}
                  onChange={(e) => setRecruiterEmail(e.target.value)}
                  maxLength={254}
                  placeholder="recruiter@company.com"
                  className={`${fieldClasses} pl-9`}
                />
              </div>
            </div>
          </div>
        </fieldset>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-3 text-xs text-[var(--status-risk-text)]"
          >
            {error}
          </p>
        )}

        {!online && (
          <p role="status" className="text-xs text-[var(--status-risk-text)] font-mono">
            You&apos;re currently offline. Reconnect to run an inspection.
          </p>
        )}

        {/* Submit Button */}
        <div className="pt-2 flex items-center justify-between">
          <button
            type="submit"
            disabled={busy || !online}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink-primary)] px-6 py-2.5 text-xs sm:text-sm font-semibold text-white transition-all hover:bg-[var(--brand-primary)] shadow-xs active:scale-95 disabled:opacity-50"
          >
            {busy ? (
              <RotateCw className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{busy ? "Submitting inspection…" : "Run inspection"}</span>
          </button>
          <span className="text-[11px] font-mono text-[var(--ink-muted)]">
            Instant heuristic & corroborated analysis
          </span>
        </div>
      </form>
    </div>
  );
}
