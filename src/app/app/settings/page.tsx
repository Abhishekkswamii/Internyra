"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/firebase/auth-context";
import { InstallCard } from "@/components/pwa/InstallCard";
import { useApi } from "@/lib/inspections-client";

export default function SettingsPage() {
  const router = useRouter();
  const api = useApi();
  const { user, logout } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteAccount = async () => {
    setBusy(true);
    setError(null);
    const r = await api<{ ok: boolean; inspectionsDeleted: number }>("/api/user/account", { method: "DELETE", forceToken: true });
    if (!r.ok) {
      setError(r.message);
      setBusy(false);
      return;
    }
    await logout().catch(() => {});
    router.replace("/");
  };

  const card = "space-y-3 rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 shadow-xs";
  const h2 = "text-sm font-semibold text-[var(--ink-primary)]";
  const p = "text-xs leading-relaxed text-[var(--ink-secondary)]";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--ink-primary)] sm:text-3xl">Settings</h1>

      <InstallCard />

      <section className={card} aria-labelledby="acct">
        <h2 id="acct" className={h2}>Account</h2>
        <p className={p}>Signed in as <strong className="text-[var(--ink-primary)]" data-testid="account-email">{user?.email ?? "unknown"}</strong>.</p>
        <button type="button" onClick={() => void logout().then(() => router.replace("/"))} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-light)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-1)]">
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />Sign out
        </button>
      </section>

      <section className={card} aria-labelledby="data">
        <h2 id="data" className={h2}>What happens to your data</h2>
        <ul className={`${p} list-disc space-y-1.5 pl-5`}>
          <li>Links, messages you paste and the reports Internyra produces are stored in your account on Google Cloud Firestore (Singapore).</li>
          <li>Pasted message text is removed from storage once your report completes. Only its length and a short fingerprint are kept.</li>
          <li>To research a submission, its text and any retrieved public page are sent to an AI provider (Google Gemini or OpenAI). Do not submit passwords, one-time codes, bank details or ID numbers.</li>
          <li>An identical recent request can reuse a cached analysis in a temporary cache (Upstash Redis). Your report is still saved as your own separate record.</li>
          <li>The administrator of this small test deployment can review submitted links, reports and account activity for operations, debugging and abuse prevention.</li>
          <li>You can delete any report from its page, or delete your whole account below. Deletion removes your Firestore records and your sign-in account.</li>
        </ul>
        <p className={p}>See the <a className="text-[var(--brand-primary)] underline" href="/privacy">privacy notice</a> and <a className="text-[var(--brand-primary)] underline" href="/terms">terms</a>.</p>
      </section>

      <section className={`${card} border-[var(--status-risk-border)]`} aria-labelledby="danger">
        <h2 id="danger" className={h2}>Delete account</h2>
        <p className={p}>Permanently deletes your account and every report saved to it. This cannot be undone.</p>
        {error && <p role="alert" className="rounded-lg border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-3 text-xs text-[var(--status-risk-text)]">{error}</p>}
        {!confirming ? (
          <button type="button" onClick={() => setConfirming(true)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--status-risk-border)] px-3 py-1.5 text-xs font-semibold text-[var(--status-risk-text)] hover:bg-[var(--status-risk-bg)]">
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Delete my account
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={deleteAccount} className="rounded-lg bg-[var(--status-risk-text)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Deleting…" : "Yes, delete everything"}</button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded-lg border border-[var(--border-light)] px-3 py-1.5 text-xs font-semibold">Cancel</button>
          </div>
        )}
      </section>
    </div>
  );
}
