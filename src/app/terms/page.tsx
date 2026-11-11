import React from "react";
import Link from "next/link";
import { Navbar } from "@/components/web/Navbar";
import { Footer } from "@/components/web/Footer";
import { Scale, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service & Disclaimer — Internyra",
  description: "Terms of use and disclaimer for the Internyra personal test release.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--canvas)] text-[var(--ink-secondary)]">
      <Navbar />
      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8 font-sans">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return Home</span>
        </Link>

        <div className="space-y-2 border-b border-[var(--border-subtle)] pb-6">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[var(--brand-primary)]">
            <Scale className="w-4 h-4" />
            <span>Legal Disclaimer</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--ink-primary)] tracking-tight">
            Terms of Use & Investigation Disclaimer
          </h1>
          <p className="text-sm text-[var(--ink-secondary)] font-mono">
            Effective Date: November 2026 · Personal Test Environment
          </p>
        </div>

        <section className="space-y-4 text-sm leading-relaxed text-[var(--ink-secondary)]">
          <h2 className="text-lg font-bold text-[var(--ink-primary)]">1. Not Legal or Employment Advice</h2>
          <p>
            Internyra is an educational and forensic research assistant designed to assist students and job seekers in reviewing public opportunities. The reports and indicators produced by Internyra are based on heuristic pattern-matching and AI-assisted public entity corroboration. They do <strong>not</strong> constitute legal advice, employment verification, or a guarantee of employment safety.
          </p>

          <h2 className="text-lg font-bold text-[var(--ink-primary)]">2. No Certification or Warranty</h2>
          <p>
            An assessment of &ldquo;Lower Concern&rdquo; does <strong>not</strong> guarantee that an opportunity is legitimate or risk-free. Conversely, an assessment of &ldquo;High Risk&rdquo; or &ldquo;Needs Review&rdquo; represents observed risk indicators and missing corroboration, not an accusation of criminal wrongdoing. You are responsible for conducting your own independent due diligence.
          </p>

          <h2 className="text-lg font-bold text-[var(--ink-primary)]">3. Acceptable Use</h2>
          <p>
            You agree to use Internyra solely for personal evaluation of internship and job opportunities. You agree not to submit malicious URLs designed to exploit vulnerabilities, attempt automated scraping of the service, or abuse free-tier API quotas.
          </p>

          <h2 className="text-lg font-bold text-[var(--ink-primary)]">4. Availability & Modification</h2>
          <p>
            This personal test deployment may be updated, paused, or modified at any time without prior notice. Operational kill-switches may temporarily pause AI-assisted research when infrastructure quotas are reached.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}

