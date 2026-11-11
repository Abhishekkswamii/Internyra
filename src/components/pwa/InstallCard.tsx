"use client";

import { useSyncExternalStore } from "react";
import { Download, Share, Smartphone } from "lucide-react";
import { detectPlatform, promptInstall, useCanInstall } from "@/lib/pwa/pwa-state";

/** Install action for Settings. Shows the real browser prompt when exposed, else honest platform instructions. */
export function InstallCard() {
  const canInstall = useCanInstall();
  const snap = useSyncExternalStore(() => () => {}, () => { const p = detectPlatform(); return `${p.ios ? 1 : 0}${p.standalone ? 1 : 0}`; }, () => "");
  if (!snap) return null;
  const env = { ios: snap[0] === "1", standalone: snap[1] === "1" };

  return (
    <section aria-labelledby="install-h" className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5" data-testid="install-card">
      <h2 id="install-h" className="flex items-center gap-2 text-sm font-bold text-[var(--ink-primary)]"><Smartphone className="h-4 w-4" aria-hidden="true" />Install Internyra</h2>
      {env.standalone ? (
        <p className="mt-2 text-sm text-[var(--ink-secondary)]">Internyra is installed and running as an app.</p>
      ) : canInstall ? (
        <>
          <p className="mt-2 text-sm text-[var(--ink-secondary)]">Add Internyra to your home screen or desktop for quicker access.</p>
          <button type="button" onClick={() => void promptInstall()} className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[var(--ink-primary)] px-4 text-sm font-semibold text-white"><Download className="h-4 w-4" aria-hidden="true" />Install Internyra</button>
        </>
      ) : env.ios ? (
        <p className="mt-2 text-sm text-[var(--ink-secondary)]">In Safari, tap <Share className="inline h-3.5 w-3.5" aria-label="Share" /> Share, then <strong>Add to Home Screen</strong>.</p>
      ) : (
        <p className="mt-2 text-sm text-[var(--ink-secondary)]">Your browser hasn&apos;t offered an install prompt. In Chrome or Edge open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. Some browsers don&apos;t support installing web apps.</p>
      )}
    </section>
  );
}
