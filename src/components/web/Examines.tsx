import React from "react";
import { Reveal } from "./Reveal";
import { IMAGES } from "@/lib/media";

/**
 * One dominant photograph and two secondary panels, deliberately different in size and treatment.
 * Panel content is fictional (reserved .example domain, made-up company) and shows only what the
 * local rules genuinely look at.
 */
export function Examines() {
  return (
    <section id="examines" className="bg-white py-20 md:py-32">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
        <Reveal className="max-w-3xl">
          <h2 className="display text-4xl sm:text-6xl">
            Three things worth <span className="serif font-normal text-[var(--brand-primary)]">looking at</span> before you say yes.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-12">
          {/* the offer & its details: dominant photograph */}
          <Reveal variant="mask-reveal" className="group relative overflow-hidden rounded-[1.75rem] bg-[var(--neutral-muted)] lg:col-span-7 lg:row-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={IMAGES.desk.src}
              srcSet={`${IMAGES.desk.small} 640w, ${IMAGES.desk.src} 1264w`}
              sizes="(min-width: 1024px) 58vw, 100vw"
              width={IMAGES.desk.width}
              height={IMAGES.desk.height}
              alt={IMAGES.desk.alt}
              loading="lazy"
              className="h-full min-h-[360px] w-full object-cover transition-transform duration-[1200ms] ease-[var(--ease-out)] group-hover:scale-[1.03]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--ink-primary)]/85 via-[var(--ink-primary)]/40 to-transparent p-7 pt-24 text-white sm:p-10 sm:pt-32">
              <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">The details</h3>
              <p className="mt-1.5 max-w-sm text-white/80">What backs the offer up, and what couldn&apos;t be checked.</p>
            </div>
          </Reveal>

          {/* the link */}
          <Reveal variant="mask-reveal" delay={120} className="relative overflow-hidden rounded-[1.75rem] bg-[var(--ink-primary)] p-7 text-white sm:p-10 lg:col-span-5">
            <div className="absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-[var(--brand-primary)] opacity-30 blur-3xl" />
            <div className="relative">
              <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">The link</h3>
              <p className="mt-1.5 text-white/65">Its structure, character by character.</p>
              <p className="mt-8 font-mono leading-tight tracking-tight" aria-label="Example link: jobs dot northwind dot example slash internship, with one Cyrillic letter">
                <span className="block text-sm text-white/70 sm:text-base">https://</span>
                <span className="block text-[1.7rem] sm:text-4xl">
                  jobs.n<mark className="rounded-md bg-[var(--citrus)] px-1 text-[var(--ink-primary)]">о</mark>rthwind
                </span>
                <span className="block text-base text-white/45 sm:text-xl">.example/internship</span>
              </p>
              <p className="mt-5 text-sm text-white/70">The highlighted letter is Cyrillic, mixed into a Latin name.</p>
              <p className="mt-4 text-xs text-white/70">Illustration of a pattern we look for, not a real submission or result.</p>
            </div>
          </Reveal>

          {/* the message */}
          <Reveal variant="mask-reveal" delay={240} className="relative overflow-hidden rounded-[1.75rem] bg-[var(--neutral-muted)] p-7 sm:p-10 lg:col-span-5">
            <h3 className="text-2xl font-semibold tracking-tight text-[var(--ink-primary)] sm:text-3xl">The message</h3>
            <p className="mt-1.5 text-[var(--ink-secondary)]">What it asks of you.</p>
            <div className="mt-6 max-w-md rounded-3xl rounded-tl-md bg-white p-5 text-[1.05rem] leading-relaxed text-[var(--ink-primary)] shadow-[0_12px_40px_-24px_rgba(21,25,37,0.5)]">
              Congratulations, you&apos;re selected! To reserve your laptop, please{" "}
              <mark className="rounded bg-[var(--citrus)] px-1 py-0.5 text-[var(--ink-primary)]">deposit $120 via UPI within 24 hours</mark>.
            </div>
            <p className="mt-4 text-xs text-[var(--ink-muted)]">Illustration of a pattern we look for, not a real submission or result.</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
