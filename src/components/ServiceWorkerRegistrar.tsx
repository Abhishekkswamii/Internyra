"use client";

import { useEffect } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { applyUpdate, captureInstallEvent, clearInstallEvent, setUpdateWorker, useOnline, useUpdateAvailable } from "@/lib/pwa/pwa-state";

/** Registers the service worker (production only), wires install/update events, and shows the offline and update notices. */
export function ServiceWorkerRegistrar() {
  const online = useOnline();
  const updateReady = useUpdateAvailable();

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      captureInstallEvent(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", clearInstallEvent);

    let reloading = false;
    let userRequested = false;
    const onClick = () => (userRequested = true);
    window.addEventListener("internyra:apply-update", onClick);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          const watch = (w: ServiceWorker | null) => {
            if (!w) return;
            w.addEventListener("statechange", () => {
              if (w.state === "installed" && navigator.serviceWorker.controller) setUpdateWorker(w);
            });
          };
          if (reg.waiting && navigator.serviceWorker.controller) setUpdateWorker(reg.waiting);
          reg.addEventListener("updatefound", () => watch(reg.installing));
          const check = () => reg.update().catch(() => {});
          const timer = window.setInterval(check, 30 * 60 * 1000);
          document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
          return () => window.clearInterval(timer);
        })
        .catch(() => {});
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading || !userRequested) return;
        reloading = true;
        window.location.reload();
      });
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", clearInstallEvent);
      window.removeEventListener("internyra:apply-update", onClick);
    };
  }, []);

  return (
    <>
      {!online && (
        <div role="status" data-testid="offline-banner" className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-[var(--ink-primary)] px-4 py-2 text-center text-xs font-medium text-white" style={{ paddingTop: "max(env(safe-area-inset-top), 8px)" }}>
          <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>You&apos;re offline. Checking internships and loading reports need an internet connection.</span>
        </div>
      )}
      {updateReady && (
        <div role="status" data-testid="update-toast" className="fixed inset-x-3 z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] p-3 text-sm shadow-lg" style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
          <span className="text-[var(--ink-primary)]">A new version of Internyra is available.</span>
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event("internyra:apply-update"));
              applyUpdate();
            }}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg bg-[var(--ink-primary)] px-3.5 text-xs font-semibold text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Update
          </button>
        </div>
      )}
    </>
  );
}
