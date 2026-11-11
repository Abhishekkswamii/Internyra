"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "./Reveal";
import { IMAGES } from "@/lib/media";

function goToChecker(e: React.MouseEvent) {
  e.preventDefault();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  document.getElementById("guest-input")?.focus({ preventScroll: true });
}

export function FinalCta() {
  return (
    <section className="bg-[var(--canvas)] px-4 pb-4 pt-10 sm:px-6 lg:px-10">
      <Reveal
        variant="mask-reveal"
        className="relative mx-auto max-w-[1320px] overflow-hidden rounded-[2rem] bg-[var(--brand-primary)] px-6 py-20 text-white sm:px-14 md:py-28"
      >
        {/* Evidence macro, masked into the panel; decorative. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] md:block" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={IMAGES.evidence.src}
            srcSet={`${IMAGES.evidence.small} 640w, ${IMAGES.evidence.src} 1200w`}
            sizes="46vw"
            width={IMAGES.evidence.width}
            height={IMAGES.evidence.height}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--brand-primary)] via-[var(--brand-primary)]/30 to-transparent" />
        </div>
        <div className="relative max-w-2xl">
          <h2 className="display text-[2.4rem] !text-white sm:text-6xl">
            Before you pay, sign, or send an ID, <span className="serif">look closer.</span>
          </h2>
          <a
            href="#guest-input"
            onClick={goToChecker}
            className="group mt-10 inline-flex h-14 items-center gap-3 rounded-full bg-[var(--citrus)] px-7 text-lg font-semibold text-[var(--ink-primary)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            Check an internship
            <ArrowUpRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </Reveal>
    </section>
  );
}
