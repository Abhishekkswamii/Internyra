"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InspectionRecord } from "@/lib/store/types";
import { useAuth } from "@/lib/firebase/auth-context";

export type Inspection = Omit<InspectionRecord, "leaseExpiresAt">;

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string; message: string };

/** Authenticated JSON call to this app's API. Messages are the server's safe, user-facing text. */
export function useApi() {
  const { getIdToken } = useAuth();
  return useCallback(
    async <T,>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; forceToken?: boolean } = {}): Promise<ApiResult<T>> => {
      const token = await getIdToken(init.forceToken);
      if (!token) return { ok: false, status: 401, code: "UNAUTHORIZED", message: "Please sign in to continue." };
      try {
        const res = await fetch(path, {
          method: init.method ?? "GET",
          headers: { Authorization: `Bearer ${token}`, ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}), ...init.headers },
          body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
          cache: "no-store",
        });
        const json = (await res.json().catch(() => null)) as (T & { error?: { code: string; message: string } }) | null;
        if (res.ok && json) return { ok: true, data: json };
        return { ok: false, status: res.status, code: json?.error?.code ?? "ERROR", message: json?.error?.message ?? "Something went wrong. Please try again." };
      } catch {
        return { ok: false, status: 0, code: "NETWORK", message: "Could not reach the server. Check your connection and try again." };
      }
    },
    [getIdToken]
  );
}

export type LoadState<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; code: string; message: string };

/** Loads one inspection and keeps polling while the server says it is queued or running. */
export function useInspection(id: string | undefined, pollMs = 3000) {
  const api = useApi();
  const { user, loading } = useAuth();
  const [state, setState] = useState<LoadState<Inspection>>({ status: "loading" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const r = await api<{ inspection: Inspection }>(`/api/inspections/${encodeURIComponent(id)}`);
    if (r.ok) setState({ status: "ready", data: r.data.inspection });
    else setState({ status: "error", code: r.code, message: r.message });
    return r.ok ? r.data.inspection : null;
  }, [api, id]);

  useEffect(() => {
    if (!id || loading || !user) return;
    let alive = true;
    const tick = async () => {
      const rec = await load();
      if (alive && rec && rec.status === "running") timer.current = setTimeout(tick, pollMs);
    };
    void tick();
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id, loading, user, load, pollMs]);

  return { state, reload: load, setState };
}

export function useAiStatus(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { aiEnabled?: boolean }) => setEnabled(Boolean(j.aiEnabled)))
      .catch(() => setEnabled(null));
  }, []);
  return enabled;
}
