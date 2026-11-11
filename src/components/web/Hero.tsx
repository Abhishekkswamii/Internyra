"use client";

import { useOnline } from "@/lib/pwa/pwa-state";
import React, { useState } from "react";
import { ArrowRight, RotateCw } from "lucide-react";
import { validateUrl } from "@/lib/engine/url";
import { MIN_TEXT_LENGTH } from "@/lib/engine/request";
import { saveDraft, type SubmissionDraft } from "@/lib/persistence/browser";
import type { VerificationRequest } from "@/types/verification";
import EvidenceLensHero from "@/components/3d/EvidenceLensHero";
import { HeroMedia } from "@/components/web/HeroMedia";
import { HERO_MEDIA } from "@/lib/media";

interface HeroProps {
  onSubmit: (request: VerificationRequest) => void;
  isRunning: boolean;
  initialDraft: SubmissionDraft | null;
}

export function Hero({ onSubmit, isRunning, initialDraft }: HeroProps) {
  const online = useOnline();
  const [activeTab, setActiveTab] = useState<"link" | "message">(initialDraft?.kind === "message" ? "message" : "link");
  const [inputValue, setInputValue] = useState((initialDraft?.kind === "message" ? initialDraft.text : initialDraft?.url) ?? "");
  const [errorMessage, setErrorMessage] = useState("");

  const submit = (value: string, kind: "link" | "message") => {
    const trimmed = value.trim();
    if (kind === "link") {
      const v = validateUrl(trimmed);
      if (!v.ok) {
        setErrorMessage(v.message);
        return;
      }
    } else if (trimmed.length < MIN_TEXT_LENGTH) {
      setErrorMessage(`Please paste the recruiter message (at least ${MIN_TEXT_LENGTH} characters).`);
      return;
    }
    setErrorMessage("");
    saveDraft(kind === "link" ? { kind, url: trimmed } : { kind, text: trimmed });
    onSubmit(
      kind === "link"
        ? { kind, url: trimmed, origin: "GUEST_PREVIEW" }
        : { kind, text: trimmed, origin: "GUEST_PREVIEW" }
    );
  };

  const handleChange = (value: string) => {
    setInputValue(value);
    if (errorMessage) setErrorMessage("");
    saveDraft(activeTab === "link" ? { kind: "link", url: value } : { kind: "message", text: value });
  };

  const modeButton = (mode: "link" | "message", label: string) => (
    <button
      type="button"
      onClick={() => {
        setActiveTab(mode);
        setErrorMessage("");
      }}
      aria-pressed={activeTab === mode}
      className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
        activeTab === mode ? "bg-[var(--ink-primary)] text-white" : "text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="relative bg-[var(--canvas)] pt-6 pb-16 md:pt-10 md:pb-24">
      <div className="mx-auto grid max-w-[1320px] items-center gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] lg:gap-14 lg:px-10">
        <div className="relative z-10">
          <h1 className="display hero-rise text-[2.6rem] sm:text-6xl xl:text-[4.25rem]">
            Check the internship <span className="serif font-normal text-[var(--brand-primary)]">before</span> you share anything.
          </h1>
          <p className="hero-rise mt-5 max-w-md text-lg leading-relaxed text-[var(--ink-secondary)]" style={{ ["--d" as string]: "90ms" }}>
            Paste a link or a recruiter message. See what Internyra found, and what it couldn&apos;t check.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!isRunning) submit(inputValue, activeTab);
            }}
            className="mt-8 max-w-xl"
            noValidate
          >
            <div className="flex items-center gap-2 rounded-full border border-[var(--ink-primary)]/15 bg-white p-1.5 pl-5 shadow-[0_10px_40px_-18px_rgba(21,25,37,0.35)] transition-shadow focus-within:border-[var(--brand-primary)] focus-within:shadow-[0_10px_40px_-14px_rgba(52,93,255,0.45)]">
              <input
                id="guest-input"
                type={activeTab === "link" ? "url" : "text"}
                inputMode={activeTab === "link" ? "url" : "text"}
                autoComplete="off"
                value={inputValue}
                onChange={(e) => handleChange(e.target.value)}
                placeholder={activeTab === "link" ? "Paste the internship link" : "Paste the recruiter message"}
                className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-[var(--ink-primary)] placeholder-[var(--ink-muted)] focus:outline-none"
                aria-label={activeTab === "link" ? "Internship link to check" : "Recruiter message to check"}
                aria-invalid={errorMessage ? true : undefined}
                aria-describedby={errorMessage ? "guest-input-error" : undefined}
              />
              <button
                type="submit"
                disabled={isRunning || !online}
                title={online ? undefined : "You're offline"}
                className="btn-primary h-12 shrink-0 px-5 text-sm"
                aria-label={isRunning ? "Running check…" : "Inspect"}
              >
                {isRunning ? (
                  <RotateCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Inspect</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
            {errorMessage && (
              <p id="guest-input-error" role="alert" className="mt-2 pl-5 text-sm font-medium text-[var(--status-risk-text)]">
                {errorMessage}
              </p>
            )}
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-[var(--ink-muted)] font-mono">
            <div className="flex rounded-full bg-[var(--neutral-muted)] p-0.5">
              {modeButton("link", "Link")}
              {modeButton("message", "Message")}
            </div>
            <span className="ml-2">
              Supports live internship links, recruiter WhatsApp/Telegram messages, and offer letter text.
            </span>
          </div>
        </div>

        {HERO_MEDIA ? (
          // Original photography leads the hero; the 3D instrument appears later as a supporting scene.
          <div className="hero-stage relative overflow-hidden rounded-[2rem] bg-[var(--ink-primary)] shadow-[0_40px_90px_-50px_rgba(21,25,37,0.6)]">
            <HeroMedia media={HERO_MEDIA} />
          </div>
        ) : (
          /* No generated media yet: the real-time instrument stands in. Dark glass shows best on ink. */
          <div
            className="hero-stage relative h-[380px] overflow-hidden rounded-[2rem] sm:h-[480px] lg:h-[640px]"
            style={{ background: "radial-gradient(120% 90% at 70% 20%, #2a3f9c 0%, #151a33 45%, #0d1020 100%)" }}
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[var(--citrus)] opacity-[0.16] blur-3xl" />
            <EvidenceLensHero />
          </div>
        )}
      </div>
    </section>
  );
}
