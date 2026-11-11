"use client";

import React, { useEffect, useState } from "react";
import { EvidenceLensFallback } from "./EvidenceLensFallback";

type LensComponent = React.ComponentType<{ className?: string; progress?: number }>;

/**
 * Loads the 3D scene on demand. The three.js chunk is requested with a plain dynamic import only after
 * this component mounts and the page is idle, so it is not downloaded on phones (where the scene is never
 * mounted) and cannot delay the headline or the URL field. The static illustration holds the space.
 */
export default function EvidenceLensHero({ className = "", progress }: { className?: string; progress?: number }) {
  const [Lens, setLens] = useState<LensComponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      import("./EvidenceLens").then((m) => {
        if (!cancelled) setLens(() => m.default);
      });
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(load, { timeout: 1500 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      };
    }
    const t = window.setTimeout(load, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  return (
    <div className={`relative h-full w-full ${className}`}>
      {Lens ? <Lens className="h-full w-full" progress={progress} /> : <EvidenceLensFallback className="h-full w-full" />}
    </div>
  );
}
