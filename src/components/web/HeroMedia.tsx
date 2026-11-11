"use client";

import React, { useEffect, useRef, useState } from "react";
import type { HeroMediaConfig } from "@/lib/media";

/**
 * Sequenced hero film: poster -> intro clip -> seamless loop.
 * - The box reserves its aspect ratio, so nothing shifts when media arrives.
 * - The loop file is not requested until the intro is actually playing.
 * - Both videos pause while offscreen. Reduced motion and any error leave the poster.
 */
export function HeroMedia({ media }: { media: HeroMediaConfig }) {
  const box = useRef<HTMLDivElement>(null);
  const intro = useRef<HTMLVideoElement>(null);
  const loop = useRef<HTMLVideoElement>(null);
  const [introPlaying, setIntroPlaying] = useState(false);
  const [loopShown, setLoopShown] = useState(false);
  const [failed, setFailed] = useState(false);
  // Unknown on the server, so no video element is rendered until the preference has been read;
  // visitors who prefer reduced motion never request the clips.
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    queueMicrotask(() => setReduced(mq.matches));
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Pause whatever is playing when the hero leaves the viewport.
  useEffect(() => {
    const el = box.current;
    if (!el || reduced || failed) return;
    const io = new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      const active = loopShown ? loop.current : intro.current;
      if (!active) return;
      if (visible) void active.play().catch(() => {});
      else active.pause();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, failed, loopShown]);

  const still = reduced !== false || failed || !media.intro || !media.loop;

  return (
    <div ref={box} className="relative w-full overflow-hidden" style={{ aspectRatio: `${media.width} / ${media.height}` }}>
      <picture>
        {media.posterMobile && <source media="(max-width: 767px)" srcSet={media.posterMobile} />}
        <img src={media.poster} alt={media.alt} width={media.width} height={media.height} className="h-full w-full object-cover" fetchPriority="high" />
      </picture>

      {!still && (
        <>
          <video
            ref={intro}
            src={media.intro}
            muted
            playsInline
            autoPlay
            preload="auto"
            aria-hidden="true"
            data-testid="hero-intro"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${introPlaying && !loopShown ? "opacity-100" : "opacity-0"}`}
            onPlaying={() => setIntroPlaying(true)}
            onEnded={() => setLoopShown(true)}
            onError={() => setFailed(true)}
          />
          {introPlaying && (
            <video
              ref={loop}
              src={media.loop}
              muted
              playsInline
              loop
              preload="auto"
              aria-hidden="true"
              data-testid="hero-loop"
              className={`absolute inset-0 h-full w-full object-cover ${loopShown ? "opacity-100" : "opacity-0"}`}
              onCanPlay={() => {
                if (loopShown) void loop.current?.play().catch(() => {});
              }}
              onError={() => setFailed(true)}
            />
          )}
        </>
      )}
    </div>
  );
}
