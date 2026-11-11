"use client";

import React, { useEffect, useRef, useState } from "react";
import EvidenceLensHero from "@/components/3d/EvidenceLensHero";

const STEPS = [
  { n: "01", title: "Submit the opportunity.", body: "A link or a recruiter message. Your request is saved right away." },
  { n: "02", title: "Examine the available evidence.", body: "After you sign in, the submission is researched. Each fact points to its source." },
  { n: "03", title: "Understand what deserves a closer look.", body: "What was found, what is only claimed, what couldn’t be established, and what to do next." },
];

/**
 * Scroll-linked on wide screens: a tall track with a pinned (sticky) stage whose active step follows
 * scroll position. It never captures scrolling. On small screens and with reduced motion the same
 * three steps are simply listed, so nothing depends on the animation.
 */
export function ThreeSteps() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  // The 3D scene is only mounted where the pinned layout is shown; phones never download or run it.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    queueMicrotask(() => setWide(mq.matches));
    const on = (e: MediaQueryListEvent) => setWide(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      if (total <= 0) return;
      const p = Math.min(1, Math.max(0, -r.top / total));
      setProgress(p);
      setActive(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length * 0.999)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="steps" className="bg-[var(--canvas)]">
      {/* Wide screens: pinned, scroll-linked */}
      <div ref={trackRef} className="steps-track relative hidden lg:block" style={{ height: "260vh" }}>
        <div className="sticky top-0 flex h-screen items-center">
          <div className="mx-auto grid w-full max-w-[1320px] grid-cols-12 items-center gap-10 px-10">
            <div className="col-span-5">
              <h2 className="display text-6xl">
                Three steps. <span className="serif font-normal text-[var(--brand-primary)]">One report.</span>
              </h2>
              <ol className="relative mt-12 space-y-7 pl-0">
                {/* Connecting line: fills as the steps advance. */}
                <span aria-hidden="true" className="pointer-events-none absolute -left-5 top-2 bottom-2 w-px bg-[var(--ink-primary)]/10">
                  <span className="absolute inset-x-0 top-0 origin-top bg-[var(--brand-primary)]" style={{ height: "100%", transform: `scaleY(${progress})` }} />
                </span>
                {STEPS.map((s, i) => (
                  <li key={s.n} className={`flex gap-5 transition-opacity duration-500 ${i === active ? "opacity-100" : "opacity-35"}`} aria-current={i === active ? "step" : undefined}>
                    <span className="font-mono text-sm pt-1.5 text-[var(--brand-primary)]">{s.n}</span>
                    <span>
                      <span className="block text-2xl font-semibold tracking-tight text-[var(--ink-primary)]">{s.title}</span>
                      <span className="mt-1 block text-[var(--ink-secondary)]">{s.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="col-span-7">
              {wide ? <StepVisual active={active} progress={progress} /> : <div className="h-[540px]" />}
            </div>
          </div>
        </div>
      </div>

      {/* Small screens & reduced motion: plain list */}
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:hidden">
        <h2 className="display text-4xl sm:text-5xl">
          Three steps. <span className="serif font-normal text-[var(--brand-primary)]">One report.</span>
        </h2>
        <ol className="mt-10 space-y-8">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-5 border-t border-[var(--ink-primary)]/10 pt-6">
              <span className="pt-1 font-mono text-sm text-[var(--brand-primary)]">{s.n}</span>
              <span>
                <span className="block text-2xl font-semibold tracking-tight text-[var(--ink-primary)]">{s.title}</span>
                <span className="mt-1 block text-[var(--ink-secondary)]">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** The live instrument: its glass layers separate as the steps advance (progress drives the scene). */
function StepVisual({ active, progress }: { active: number; progress: number }) {
  return (
    <div
      className="relative h-[540px] overflow-hidden rounded-[2rem]"
      style={{ background: "radial-gradient(120% 90% at 70% 20%, #2a3f9c 0%, #151a33 45%, #0d1020 100%)" }}
    >
      <EvidenceLensHero progress={progress} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/10" aria-hidden="true">
        <div className="h-full bg-[var(--citrus)]" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <span className="sr-only">Step {active + 1} of {STEPS.length}</span>
    </div>
  );
}
