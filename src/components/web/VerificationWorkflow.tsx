"use client";

import React from "react";
import Image from "next/image";
import { ShieldCheck, Search, Database, Layers, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "./Reveal";

export function VerificationWorkflow() {
  return (
    <section id="workflow" className="relative overflow-hidden bg-[var(--ink-primary)] py-20 text-white md:py-32">
      <div className="pointer-events-none absolute -left-32 top-0 h-[480px] w-[480px] rounded-full bg-[var(--brand-primary)] opacity-20 blur-[120px]" />

      <div className="relative mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
        <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-mono font-medium text-[var(--citrus)] uppercase tracking-wider">
              <Layers className="h-3.5 w-3.5" />
              <span>Forensic Verification Engine</span>
            </div>
            <h2 className="display mt-4 max-w-2xl text-4xl !text-white sm:text-6xl">
              How Internyra verifies <span className="serif font-normal text-[var(--citrus)]">every claim.</span>
            </h2>
          </div>
          <p className="max-w-md text-base text-white/70 leading-relaxed font-sans">
            There are no numerical &ldquo;trust scores.&rdquo; A report keeps four things apart: facts tied to a source, claims the sender made, our inferences, and what could not be established.
          </p>
        </Reveal>

        {/* Multi-Layer Visual Feature Grid */}
        <div className="mt-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Visual Evidence Macro Photograph */}
          <div className="lg:col-span-6">
            <Reveal delay={100} className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] bg-[#151925]">
              <Image
                src="/images/internyra/evidence-layer-detail.webp"
                alt="Macro detail of three layered translucent documents separated by metal spacers, illuminated by a focused cobalt blue optical inspection beam."
                fill
                sizes="(max-width: 1024px) 100vw, 600px"
                className="object-cover object-center select-none"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#151925]/80 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-[#151925]/90 backdrop-blur-md border border-white/10 text-xs font-mono text-white/80">
                <span className="text-[var(--citrus)] font-bold">{"// OPTICAL LAYER SCAN:"}</span> A report separates what is sourced, what is only claimed, and what is unknown.
              </div>
            </Reveal>
          </div>

          {/* Verification Pillars */}
          <div className="lg:col-span-6 space-y-4">
            <Reveal delay={150} className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-8 h-8 rounded-lg bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-white">1. Structural & Transport Lineage</h3>
              </div>
              <p className="text-sm text-white/70 leading-relaxed pl-11">
                Reads the link itself: lookalike characters (such as Cyrillic letters in a Latin name), unusual ports, URL shorteners and raw IP addresses. These local checks run without opening the page.
              </p>
            </Reveal>

            <Reveal delay={200} className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-8 h-8 rounded-lg bg-[var(--citrus)]/20 text-[var(--citrus)] border border-[var(--citrus)]/30">
                  <Search className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-white">2. Language & Financial Demands</h3>
              </div>
              <p className="text-sm text-white/70 leading-relaxed pl-11">
                Looks in the text you submit for fee and deposit requests, requests for sensitive details, pressure to act fast, and hiring that happens only over chat apps.
              </p>
            </Reveal>

            <Reveal delay={250} className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-8 h-8 rounded-lg bg-emerald-400/20 text-emerald-400 border border-emerald-400/30">
                  <Database className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-white">3. Research with sources</h3>
              </div>
              <p className="text-sm text-white/70 leading-relaxed pl-11">
                After you sign in, an AI model researches the submission. It may read the public page you linked (never behind a login) and, when enabled, search the web. A fact appears in the report only if it can be tied to a retrieved source with a matching quote.
              </p>
            </Reveal>
          </div>
        </div>

        {/* Honest Transparency Callout */}
        <Reveal delay={300} className="mt-12 p-6 rounded-2xl border border-white/10 bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">Honest Scope & Verification Limitations</h4>
            <p className="text-xs text-white/70 leading-relaxed">
              Internyra is research support, not a certification. It cannot prove an offer is genuine, and every report lists what could not be checked.
            </p>
          </div>
          <Link
            href="/app/verify"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-bold text-[var(--ink-primary)] hover:bg-[var(--citrus)] transition-colors shrink-0 font-mono shadow-md"
          >
            <span>Start an inspection</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
