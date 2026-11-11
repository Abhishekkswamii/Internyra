"use client";

import { useEffect } from "react";

/** Registers the app-shell service worker in production builds only (dev HMR and SW caching conflict). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Offline shell is an enhancement; the app works without it.
    });
  }, []);
  return null;
}
