"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/web/Navbar";
import { Hero } from "@/components/web/Hero";
import { LockedScanPreview } from "@/components/web/LockedScanPreview";
import { Examines } from "@/components/web/Examines";
import { VerificationWorkflow } from "@/components/web/VerificationWorkflow";
import { ThreeSteps } from "@/components/web/ThreeSteps";
import { FinalCta } from "@/components/web/FinalCta";
import { FaqSection } from "@/components/web/FaqSection";
import { Footer } from "@/components/web/Footer";
import { clearDraft, loadDraft } from "@/lib/persistence/browser";
import { useHydrated } from "@/lib/use-hydrated";
import { useAuth } from "@/lib/firebase/auth-context";
import { useApi, type Inspection } from "@/lib/inspections-client";
import type { VerificationRequest } from "@/types/verification";

function scrollToPreview() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(() => document.getElementById("guest-preview")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }), 50);
}

export default function HomePage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const draft = hydrated ? loadDraft() : null;
  const { user, loading, isAnonymous, configured, ensureAnonymous } = useAuth();
  const api = useApi();

  const [pending, setPending] = useState<Inspection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // A visitor who refreshes keeps their saved request: it lives on the server under their anonymous identity.
  useEffect(() => {
    if (loading || !user || !isAnonymous) return;
    let alive = true;
    api<{ inspections: Inspection[] }>("/api/inspections?limit=5").then((r) => {
      if (!alive || !r.ok) return;
      const latest = r.data.inspections.find((i) => i.status === "pending_auth");
      if (latest) setPending(latest);
    });
    return () => {
      alive = false;
    };
  }, [loading, user, isAnonymous, api]);

  const handleSubmit = async (request: VerificationRequest) => {
    setNotice(null);
    if (!configured) {
      setNotice("Sign-in is not available on this deployment yet, so inspections cannot be saved.");
      return;
    }
    setSubmitting(true);
    try {
      const identity = user ?? (await ensureAnonymous());
      if (!identity) {
        setNotice("Could not start a secure session. Please check your connection and try again.");
        return;
      }
      const { origin: _origin, ...body } = request;
      void _origin;
      const r = await api<{ inspection: Inspection }>("/api/inspections", { method: "POST", body });
      if (!r.ok) {
        setNotice(r.message);
        return;
      }
      clearDraft(); // the pasted text now lives only in the saved inspection
      const rec = r.data.inspection;
      if (rec.status === "pending_auth") {
        setPending(rec);
        scrollToPreview();
      } else {
        router.push(`/app/reports/${encodeURIComponent(rec.id)}?start=1`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (pending) await api(`/api/inspections/${encodeURIComponent(pending.id)}`, { method: "DELETE" });
    setPending(null);
    window.scrollTo({ top: 0, behavior: "auto" });
    document.getElementById("guest-input")?.focus({ preventScroll: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--canvas)] text-[var(--ink-secondary)]">
      <Navbar />
      <main className="flex-1">
        <Hero key={hydrated ? "client" : "server"} initialDraft={draft} onSubmit={handleSubmit} isRunning={submitting} />
        {notice && (
          <p role="alert" className="mx-auto max-w-3xl px-4 py-3 text-center text-sm text-[var(--status-risk-text)]">{notice}</p>
        )}
        {pending && <LockedScanPreview inspection={pending} onReset={handleReset} />}
        <Examines />
        <VerificationWorkflow />
        <ThreeSteps />
        <FinalCta />
        <FaqSection />
      </main>
      <Footer />
    </div>
  );
}
