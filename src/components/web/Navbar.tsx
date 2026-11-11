"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ArrowRight, Menu, X } from "lucide-react";

const LINKS = [
  { href: "#examines", id: "examines", label: "What it examines" },
  { href: "#workflow", id: "workflow", label: "Forensic workflow" },
  { href: "#steps", id: "steps", label: "How it works" },
  { href: "#faq", id: "faq", label: "Questions" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("");

  // Mark the section nearest the top of the viewport.
  useEffect(() => {
    const els = LINKS.map((l) => document.getElementById(l.id)).filter(Boolean) as HTMLElement[];
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-35% 0px -55% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 w-full bg-[var(--canvas)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between px-4 sm:px-6 lg:px-10">
        <Logo variant="full" size="md" />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
          {LINKS.map((l) => (
            <Link
              key={l.id}
              href={l.href}
              aria-current={active === l.id ? "true" : undefined}
              className={`relative rounded-full px-3.5 py-2 text-sm font-medium transition-colors after:absolute after:inset-x-3.5 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-[var(--brand-primary)] after:transition-transform after:duration-300 hover:text-[var(--ink-primary)] ${
                active === l.id ? "text-[var(--ink-primary)] after:scale-x-100" : "text-[var(--ink-secondary)] hover:after:scale-x-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Link href="/app" className="rounded-full px-4 py-2 text-sm font-medium text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink-primary)]">
            Access Core
          </Link>
          <Link href="/app" className="group inline-flex items-center gap-2 rounded-full bg-[var(--ink-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-primary)] active:scale-[0.985]">
            <span>Launch Dashboard</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="grid h-11 w-11 place-items-center rounded-full border border-[var(--ink-primary)]/15 text-[var(--ink-primary)] md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="animate-fade-in border-t border-[var(--border-light)] bg-[var(--canvas)] px-4 pb-6 pt-3 md:hidden">
          <nav className="flex flex-col text-lg font-medium text-[var(--ink-primary)]" aria-label="Sections">
            {LINKS.map((l) => (
              <Link key={l.id} href={l.href} onClick={() => setOpen(false)} className="border-b border-[var(--border-subtle)] py-3.5">
                {l.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/app"
            onClick={() => setOpen(false)}
            className="btn-primary mt-5 h-12 w-full text-base"
          >
            Open Core Dashboard
          </Link>
        </div>
      )}
    </header>
  );
}
