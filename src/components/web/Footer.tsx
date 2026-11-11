import React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { RULESET_VERSION } from "@/lib/engine/version";

export function Footer() {
  return (
    <footer className="bg-[var(--ink-primary)] py-12 text-white/70">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-8 px-4 sm:px-6 lg:px-10">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-start">
          <div className="space-y-3">
            <Logo variant="full" size="md" theme="dark" />
            <p className="max-w-sm text-sm leading-relaxed">
              Evidence-based internship intelligence and safety research. Findings are an investigative starting point, not a guarantee.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2.5 text-sm sm:grid-cols-4 md:gap-x-10">
            <Link href="/app" className="transition-colors hover:text-white">Core dashboard</Link>
            <Link href="/app/verify" className="transition-colors hover:text-white">New check</Link>
            <Link href="/privacy" className="transition-colors hover:text-white">Privacy Notice</Link>
            <Link href="/terms" className="transition-colors hover:text-white">Terms & Disclaimer</Link>
          </nav>
        </div>
        <div className="flex flex-col justify-between gap-2 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row">
          <p>© 2026 Internyra. Not affiliated with any employer or job platform.</p>
          <p>Ruleset {RULESET_VERSION} · Cloud Firestore & AI-assisted research</p>
        </div>
      </div>
    </footer>
  );
}
