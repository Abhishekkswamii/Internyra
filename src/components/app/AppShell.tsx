"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import {
  LayoutDashboard,
  ShieldCheck,
  Settings,
  Plus,
  Search,
  ArrowUpRight,
  ShieldAlert,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/firebase/auth-context";

interface AppShellProps {
  children: React.ReactNode;
}

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/app/verify")) return "New inspection";
  if (pathname.startsWith("/app/settings")) return "Settings";
  if (pathname.startsWith("/app/admin")) return "Admin console";
  if (pathname.startsWith("/app/reports")) return "Investigation report";
  return "Workspace";
}

function DesktopNav() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  const navItems = [
    { label: "Dashboard", href: "/app", icon: LayoutDashboard },
    { label: "New inspection", href: "/app/verify", icon: ShieldCheck },
    ...(isAdmin ? [{ label: "Admin console", href: "/app/admin", icon: ShieldAlert }] : []),
    { label: "Settings", href: "/app/settings", icon: Settings },
  ];

  return (
    <nav aria-label="Primary" className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/app"
            ? pathname === "/app"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              isActive
                ? "bg-[var(--surface-accent)] text-[#2447d6] shadow-2xs font-bold"
                : "text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-1)]"
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon
                className={`w-4 h-4 transition-colors ${
                  isActive ? "text-[var(--brand-primary)]" : "text-[var(--ink-muted)] group-hover:text-[var(--ink-primary)]"
                }`}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </div>
            {item.href === "/app/admin" && (
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-red-100 text-red-700 px-1.5 py-0.2 rounded border border-red-200">
                Staff
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  const navItems = [
    { label: "Dashboard", href: "/app", icon: LayoutDashboard },
    { label: "Verify", href: "/app/verify", icon: ShieldCheck },
    ...(isAdmin ? [{ label: "Admin", href: "/app/admin", icon: ShieldAlert }] : []),
    { label: "Settings", href: "/app/settings", icon: Settings },
  ];

  return (
    <nav
      aria-label="Primary"
      data-testid="bottom-nav"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--surface-0)]/95 backdrop-blur-md border-t border-[var(--border-light)] px-2 pt-1.5 flex items-center justify-around shadow-[0_-4px_20px_-8px_rgba(21,25,37,0.15)]"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
        paddingLeft: "max(env(safe-area-inset-left), 8px)",
        paddingRight: "max(env(safe-area-inset-right), 8px)",
      }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/app"
            ? pathname === "/app"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center py-1.5 px-2 rounded-xl touch-target transition-all duration-150 ${
              isActive
                ? "text-[#2447d6] font-bold bg-[var(--surface-accent)]/80"
                : "text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
            }`}
          >
            <Icon
              className={`w-4 h-4 ${
                isActive ? "text-[var(--brand-primary)]" : "text-[var(--ink-muted)]"
              }`}
              aria-hidden="true"
            />
            <span className="text-[10px] font-semibold mt-0.5 tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAnonymous, isAdmin, logout } = useAuth();
  const signedIn = Boolean(user && !isAnonymous);
  const [searchQuery, setSearchQuery] = useState("");

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/app?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const userInitial = (user?.displayName || user?.email || "U").charAt(0).toUpperCase();
  const userDisplayName = user?.displayName || user?.email?.split("@")[0] || "Student";
  const userFullEmail = user?.email || "student@internyra.org";

  return (
    <div className="min-h-dvh bg-[var(--canvas)] text-[var(--ink-primary)] flex flex-col md:flex-row antialiased">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col justify-between w-64 shrink-0 bg-[var(--surface-0)] border-r border-[var(--border-light)] h-dvh sticky top-0 px-4 py-5 select-none z-30">
        {/* Brand Lockup & Top Navigation */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2 pt-1">
            <Logo variant="full" size="md" href="/app" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[var(--surface-accent)] text-[#2447d6] px-2 py-0.5 rounded-md border border-[#c5d5ff]">
              Core
            </span>
          </div>

          <div className="space-y-1">
            <p className="px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--ink-muted)] mb-2">
              Menu
            </p>
            <Suspense fallback={<div className="h-44 bg-[var(--surface-2)] rounded-xl animate-pulse" />}>
              <DesktopNav />
            </Suspense>
          </div>
        </div>

        {/* Sidebar Footer: Refined User Profile Card */}
        <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
          <div className="relative rounded-2xl bg-[var(--surface-1)] border border-[var(--border-light)] p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="grid place-items-center w-7 h-7 rounded-lg bg-[var(--ink-primary)] text-white font-mono font-bold text-xs shrink-0"
                  aria-hidden="true"
                >
                  {userInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[var(--ink-primary)] truncate">
                    {userDisplayName}
                  </p>
                  <p className="text-[10px] font-mono text-[var(--ink-muted)] truncate">
                    {userFullEmail}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <span className="text-[9px] font-mono font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200 shrink-0">
                  ADMIN
                </span>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)] text-[11px] font-mono">
              <div className="flex items-center gap-1.5 text-[var(--ink-muted)]">
                <span className={`w-1.5 h-1.5 rounded-full ${signedIn ? "bg-emerald-500" : "bg-slate-300"}`} />
                <span>{signedIn ? "Authenticated" : "Guest"}</span>
              </div>
              {signedIn && (
                <button
                  type="button"
                  onClick={() => logout()}
                  className="inline-flex items-center gap-1 text-[var(--status-risk-text)] hover:underline font-semibold"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Out</span>
                </button>
              )}
            </div>
          </div>

          <div className="px-2 flex items-center justify-between text-[11px] font-mono text-[var(--ink-muted)]">
            <span>Internyra Workspace</span>
            <Link
              href="/"
              className="inline-flex items-center gap-1 hover:text-[var(--brand-primary)] transition-colors"
              title="Return to public landing page"
            >
              <span>Site</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </aside>

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between bg-[var(--surface-0)]/90 backdrop-blur-md border-b border-[var(--border-light)] px-4 sm:px-6 lg:px-8 h-16 transition-colors">
          {/* Left: Mobile Title or Search */}
          <div className="flex items-center gap-3.5 flex-1 max-w-lg">
            <div className="md:hidden flex items-center gap-2.5 min-w-0">
              <Logo variant="icon" size="sm" href="/app" />
              <p className="truncate text-sm sm:text-base font-bold text-[var(--ink-primary)]" data-testid="mobile-title">
                {pageTitle(pathname)}
              </p>
            </div>

            {/* Desktop Universal Search */}
            <form onSubmit={handleGlobalSearch} className="hidden md:flex items-center w-full max-w-sm relative">
              <Search className="w-3.5 h-3.5 text-[var(--ink-muted)] absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search inspections..."
                aria-label="Search inspections"
                className="w-full bg-[var(--canvas)] border border-[var(--border-light)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--ink-primary)] placeholder-[var(--ink-muted)] focus:outline-none focus:border-[var(--brand-primary)] focus:bg-[var(--surface-0)] transition-all font-mono"
              />
            </form>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            {pathname !== "/app" && pathname !== "/app/verify" && (
              <Link
                href="/app/verify"
                aria-label="New inspection"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--ink-primary)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[var(--brand-primary)] transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">New inspection</span>
              </Link>
            )}

            {/* Account Quick Profile */}
            <div className="relative">
              <Link
                href="/app/settings"
                aria-label="Account settings"
                className="flex items-center gap-2 pl-2 border-l border-[var(--border-light)] hover:opacity-85 transition-opacity"
              >
                <div
                  className="grid place-items-center w-8 h-8 rounded-xl bg-[var(--surface-2)] text-[var(--ink-primary)] font-mono font-bold text-xs border border-[var(--border-light)]"
                  aria-hidden="true"
                >
                  {userInitial}
                </div>
                <div className="hidden lg:block text-left max-w-[130px]">
                  <p className="text-xs font-bold text-[var(--ink-primary)] leading-tight truncate">
                    {userDisplayName}
                  </p>
                  <p className="text-[10px] text-[var(--ink-muted)] font-mono truncate">
                    {signedIn ? "Signed in" : "Signed out"}
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-12">
          {children}
        </main>

        {/* Mobile Fixed Bottom Navigation */}
        <Suspense fallback={null}>
          <MobileNav />
        </Suspense>
      </div>
    </div>
  );
}
