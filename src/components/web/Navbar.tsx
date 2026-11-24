"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { useRouter } from "next/navigation";
import { ChevronDown, LayoutDashboard, LogOut, Menu, Settings, ShieldAlert, X } from "lucide-react";
import { useAuth } from "@/lib/firebase/auth-context";

const LINKS = [
  { href: "#examines", id: "examines", label: "What it examines" },
  { href: "#workflow", id: "workflow", label: "Forensic workflow" },
  { href: "#steps", id: "steps", label: "How it works" },
  { href: "#faq", id: "faq", label: "Questions" },
];

function AccountMenu({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const label = user?.displayName || user?.email || "Account";
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  const out = async () => {
    setOpen(false);
    onNavigate?.();
    await logout();
    router.push("/");
  };
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu" className="inline-flex items-center gap-2 rounded-full border border-[var(--ink-primary)]/15 py-1.5 pl-1.5 pr-3 text-sm font-medium text-[var(--ink-primary)] hover:bg-white">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--ink-primary)] text-xs font-bold text-white" aria-hidden="true">{label.charAt(0).toUpperCase()}</span>
        <span className="hidden max-w-[130px] truncate lg:inline" data-testid="nav-account-name">{label}</span>
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-[var(--border-light)] bg-white p-1.5 shadow-lg">
          <p className="truncate px-3 py-2 text-xs text-[var(--ink-muted)]">{user?.email}</p>
          <Link role="menuitem" href="/app/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-[var(--surface-1)]"><Settings className="h-4 w-4" aria-hidden="true" />Account settings</Link>
          {isAdmin && <Link role="menuitem" href="/app/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-[var(--surface-1)]"><ShieldAlert className="h-4 w-4" aria-hidden="true" />Admin dashboard</Link>}
          <button role="menuitem" type="button" onClick={out} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--surface-1)]"><LogOut className="h-4 w-4" aria-hidden="true" />Log out</button>
        </div>
      )}
    </div>
  );
}

interface NavbarProps {
  onOpenLogin?: () => void;
  onOpenSignup?: () => void;
}

export function Navbar({ onOpenLogin, onOpenSignup }: NavbarProps = {}) {
  const { user, loading, isAnonymous, isAdmin, logout } = useAuth();
  const router = useRouter();
  // A visitor holding only an anonymous identity (a pending request) is still signed out.
  const signedIn = Boolean(user && !isAnonymous);
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
    <header className="sticky top-0 z-[60] w-full bg-[var(--canvas)]/85 backdrop-blur-md">
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

        {/* Reserve the space until auth state is restored, so the wrong actions never flash. */}
        <div className="hidden min-w-[190px] items-center justify-end gap-2 md:flex" data-testid="nav-actions" data-auth={loading ? "loading" : signedIn ? "in" : "out"}>
          {loading ? null : signedIn ? (
            <>
              <Link href="/app" className="inline-flex items-center gap-2 rounded-full bg-[var(--ink-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-primary)]">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" /><span>Dashboard</span>
              </Link>
              {isAdmin && <Link href="/app/admin" className="rounded-full px-3 py-2 text-sm font-medium text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]">Admin</Link>}
              <AccountMenu />
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={(e) => {
                  if (onOpenLogin) {
                    e.preventDefault();
                    if (typeof window !== "undefined") window.history.pushState(null, "", "/login");
                    onOpenLogin();
                  }
                }}
                className="rounded-full px-4 py-2 text-sm font-medium text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink-primary)]"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={(e) => {
                  if (onOpenSignup) {
                    e.preventDefault();
                    if (typeof window !== "undefined") window.history.pushState(null, "", "/signup");
                    onOpenSignup();
                  }
                }}
                className="inline-flex items-center rounded-full bg-[var(--ink-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-primary)] active:scale-[0.985]"
              >
                Sign up
              </Link>
            </>
          )}
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
          <div className="mt-5 flex flex-col gap-3" data-testid="mobile-nav-actions" data-auth={loading ? "loading" : signedIn ? "in" : "out"}>
            {loading ? null : signedIn ? (
              <>
                <Link href="/app" onClick={() => setOpen(false)} className="btn-primary h-12 w-full text-base">Dashboard</Link>
                {isAdmin && <Link href="/app/admin" onClick={() => setOpen(false)} className="flex h-12 items-center justify-center rounded-full border border-[var(--ink-primary)]/15 text-base font-medium">Admin dashboard</Link>}
                <Link href="/app/settings" onClick={() => setOpen(false)} className="flex h-12 items-center justify-center rounded-full border border-[var(--ink-primary)]/15 text-base font-medium">Account settings</Link>
                <button type="button" onClick={async () => { setOpen(false); await logout(); router.push("/"); }} className="flex h-12 items-center justify-center rounded-full text-base font-medium text-[var(--ink-secondary)]">Log out</button>
              </>
            ) : (
              <>
                <Link
                  href="/signup"
                  onClick={(e) => {
                    setOpen(false);
                    if (onOpenSignup) {
                      e.preventDefault();
                      if (typeof window !== "undefined") window.history.pushState(null, "", "/signup");
                      onOpenSignup();
                    }
                  }}
                  className="btn-primary h-12 w-full text-base"
                >
                  Sign up
                </Link>
                <Link
                  href="/login"
                  onClick={(e) => {
                    setOpen(false);
                    if (onOpenLogin) {
                      e.preventDefault();
                      if (typeof window !== "undefined") window.history.pushState(null, "", "/login");
                      onOpenLogin();
                    }
                  }}
                  className="flex h-12 items-center justify-center rounded-full border border-[var(--ink-primary)]/15 text-base font-medium"
                >
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
