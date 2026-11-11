"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * false during SSR and the hydration render, true afterwards. Use as a `key` to remount form
 * components once browser-only state (drafts) can be read without a hydration mismatch.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
