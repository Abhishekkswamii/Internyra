"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/web/Navbar";
import { Hero } from "@/components/web/Hero";
import { AuthDialog, type AuthMode } from "@/components/auth/AuthDialog";
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

export default function HomePage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const draft = hydrated ? loadDraft() : null;
  const { user, loading, isAnonymous, configured, ensureAnonymous } = useAuth();
  const api = useApi();

  const [pending, setPending] = useState<Inspection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Authentication dialog state
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");

  // A visitor who refreshes keeps their saved request under their anonymous identity.
  useEffect(() => {
    if (loading || !user || !isAnonymous) return;
    let alive = true;
    api<{ inspections: Inspection[] }>("/api/inspections?limit=5").then((r) => {
      if (!alive || !r.ok) return;
      const latest = r.data.inspections.find((i) => i.status === "pending_auth");
      if (latest) {
        setPending(latest);
        setAuthOpen(true);
      }
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
        setAuthMode("signup");
        setAuthOpen(true);
        // Scroll position is preserved: NO scroll down to an inline card!
      } else {
        router.push(`/app/reports/${encodeURIComponent(rec.id)}?start=1`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--canvas)] text-[var(--ink-secondary)]">
      <Navbar
        onOpenLogin={() => {
          setAuthMode("login");
          setAuthOpen(true);
        }}
        onOpenSignup={() => {
          setAuthMode("signup");
          setAuthOpen(true);
        }}
      />
      <main className="flex-1">
        <Hero
          key={hydrated ? "client" : "server"}
          initialDraft={draft}
          onSubmit={handleSubmit}
          isRunning={submitting}
        />
        {notice && (
          <p
            role="alert"
            className="mx-auto max-w-3xl px-4 py-3 text-center text-sm text-[var(--status-risk-text)]"
          >
            {notice}
          </p>
        )}

        <Examines />
        <VerificationWorkflow />
        <ThreeSteps />
        <FinalCta />
        <FaqSection />
      </main>
      <Footer />

      {/* Centered Authentication Modal Dialog */}
      <AuthDialog
        open={authOpen}
        initialMode={authMode}
        onClose={() => {
          setAuthOpen(false);
          if (typeof window !== "undefined" && (window.location.pathname === "/login" || window.location.pathname === "/signup")) {
            window.history.pushState(null, "", "/");
          }
        }}
        pendingInspection={pending}
      />
    </div>
  );
}
