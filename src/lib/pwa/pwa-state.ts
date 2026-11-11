"use client";

import { useSyncExternalStore } from "react";

type Listener = () => void;
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let installEvent: InstallEvent | null = null;
let updateWorker: ServiceWorker | null = null;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: Listener) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function captureInstallEvent(e: Event) {
  installEvent = e as InstallEvent;
  emit();
}
export function clearInstallEvent() {
  installEvent = null;
  emit();
}
export function setUpdateWorker(w: ServiceWorker | null) {
  updateWorker = w;
  emit();
}
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!installEvent) return "unavailable";
  const ev = installEvent;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  installEvent = null;
  emit();
  return outcome;
}
/** Activates the waiting worker. The page reloads on controllerchange (registrar), only after this explicit user action. */
export function applyUpdate() {
  updateWorker?.postMessage("SKIP_WAITING");
}
/** Deletes every Cache Storage entry — called at logout so nothing outlives the session. */
export async function clearPrivateCaches() {
  try {
    if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    const reg = await navigator.serviceWorker?.getRegistration();
    reg?.active?.postMessage("CLEAR_CACHES");
  } catch {
    // best effort
  }
}

export const useCanInstall = () => useSyncExternalStore(subscribe, () => installEvent !== null, () => false);
export const useUpdateAvailable = () => useSyncExternalStore(subscribe, () => updateWorker !== null, () => false);

const onlineSub = (l: Listener) => {
  window.addEventListener("online", l);
  window.addEventListener("offline", l);
  return () => {
    window.removeEventListener("online", l);
    window.removeEventListener("offline", l);
  };
};
export const useOnline = () => useSyncExternalStore(onlineSub, () => navigator.onLine, () => true);

export function detectPlatform(): { ios: boolean; standalone: boolean } {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return { ios, standalone };
}
