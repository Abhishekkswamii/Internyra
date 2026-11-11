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
  LogIn,
} from "lucide-react";
import { useAuth } from "@/lib/firebase/auth-context";

interface AppShellProps {
  children: React.ReactNode;
}

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/app/verify")) return "New inspection";
  if (pathname.startsWith("/app/settings")) return "Settings";
  if (pathname.startsWith("/app/admin")) return "Admin";
  if (pathname.startsWith("/app/reports")) return "Report";
  return "Dashboard";
}

function DesktopNav() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  const navItems = [
    { label: "Dashboard", href: "/app", icon: LayoutDashboard },
    { label: "New inspection", href: "/app/verify", icon: ShieldCheck },
    ...(isAdmin ? [{ label: "Admin", href: "/app/admin", icon: ShieldAlert }] : []),
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
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-[var(--surface-accent)] text-[#2a4de0]"
                : "text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-1)]"
            }`}
          >
            <Icon
              className={`w-4 h-4 ${
                isActive ? "text-[var(--brand-primary)]" : "text-[var(--ink-muted)]"
              }`}
            />
            <span>{item.label}</span>
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
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--surface-0)] border-t border-[var(--border-light)] px-2 pt-1.5 flex items-center justify-around shadow-[0_-4px_16px_-12px_rgba(21,25,37,0.25)]"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)", paddingLeft: "max(env(safe-area-inset-left), 8px)", paddingRight: "max(env(safe-area-inset-right), 8px)" }}
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
            className={`flex flex-1 flex-col items-center justify-center py-1 px-3 rounded-xl touch-target transition-colors duration-150 ${
              isActive ? "text-[#2a4de0] font-bold bg-[var(--surface-accent)]" : "text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? "text-[var(--brand-primary)]" : "text-[var(--ink-muted)]"}`} />
            <span className="text-[11px] font-medium mt-0.5">{item.label}</span>
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
  const userDisplayName = user?.displayName || user?.email || "Signed in";

  return (
    <div className="min-h-dvh bg-[var(--canvas)] text-[var(--ink-primary)] flex flex-col md:flex-row">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col justify-between w-64 shrink-0 bg-[var(--surface-0)] border-r border-[var(--border-light)] h-dvh sticky top-0 px-4 py-5 select-none">
        
        {/* Brand Lockup */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <Logo variant="full" size="md" href="/app" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[var(--surface-accent)] text-[#2a4de0] px-2 py-0.5 rounded border border-[var(--border-light)]">
              Core
            </span>
          </div>

          {/* Navigation Items in Suspense */}
          <Suspense fallback={<div className="h-44 bg-[var(--surface-2)] rounded-lg animate-pulse" />}>
            <DesktopNav />
          </Suspense>
        </div>

        {/* Sidebar Footer / Account Info */}
        <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
          <div className="rounded-xl bg-[var(--canvas)] border border-[var(--border-light)] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold">
              <span className="text-[var(--ink-primary)] truncate max-w-[140px]">{userDisplayName}</span>
              {isAdmin && (
                <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-200">
                  ADMIN
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--ink-secondary)] leading-relaxed">
              {signedIn ? "Signed in. Your inspections are saved to your account." : "Sign in to see your saved inspections."}
            </p>
            {signedIn ? (
              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--status-risk-text)] hover:underline font-mono"
              >
                <LogOut className="w-3 h-3" />
                <span>Sign out</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--ink-muted)] font-mono">
                <LogIn className="w-3 h-3" />
                <span>Signed out</span>
              </span>
            )}
          </div>

          <div className="px-2 flex items-center justify-between text-[11px] font-mono text-[var(--ink-muted)]">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${signedIn ? "bg-emerald-500" : "bg-slate-300"}`} />
              <span>{signedIn ? "Signed in" : "Signed out"}</span>
            </div>
            <Link href="/" className="hover:text-[var(--brand-primary)] transition-colors" title="Return to Landing Page">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-[var(--surface-0)]/95 backdrop-blur-md border-b border-[var(--border-light)] px-4 sm:px-6 lg:px-8 h-16">
          
          {/* Left: Mobile Logo & Desktop Search */}
          <div className="flex items-center gap-4 flex-1 max-w-lg">
            <div className="md:hidden flex items-center gap-2.5 min-w-0">
              <Logo variant="icon" size="sm" href="/app" />
              <p className="truncate text-base font-bold text-[var(--ink-primary)]" data-testid="mobile-title">{pageTitle(pathname)}</p>
            </div>

            {/* Desktop Universal Search */}
            <form onSubmit={handleGlobalSearch} className="hidden md:flex items-center w-full max-w-sm relative">
              <Search className="w-4 h-4 text-[var(--ink-muted)] absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search inspections..."
                aria-label="Search inspections"
                className="w-full bg-[var(--canvas)] border border-[var(--border-light)] rounded-lg pl-9 pr-4 py-1.5 text-xs sm:text-sm text-[var(--ink-primary)] placeholder-[var(--ink-faint)] focus:outline-none focus:border-[var(--brand-primary)] focus:bg-[var(--surface-0)] transition-all font-mono"
              />
            </form>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {pathname !== "/app/verify" && <Link
              href="/app/verify"
              className="hidden md:inline-flex items-center gap-1.5 rounded-lg bg-[var(--ink-primary)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[var(--brand-primary)] transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New inspection</span>
              </Link>}

            <Link href="/app/settings" aria-label="Account and settings" className="flex items-center gap-2 pl-2 border-l border-[var(--border-light)]">
              <div className="grid place-items-center w-8 h-8 rounded-lg bg-[var(--surface-2)] text-[var(--ink-primary)] font-mono font-bold text-xs border border-[var(--border-light)]" aria-hidden="true">
                {userInitial}
              </div>
              <div className="hidden lg:block text-left max-w-[130px]">
                <p className="text-xs font-bold text-[var(--ink-primary)] leading-tight truncate">{userDisplayName}</p>
                <p className="text-[10px] text-[var(--ink-muted)] font-mono truncate">{signedIn ? "Signed in" : "Signed out"}</p>
              </div>
            </Link>
          </div>

        </header>

        {/* Dynamic Route Children Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8">
          {children}
        </main>

        {/* Fixed Mobile Bottom Navigation Bar in Suspense */}
        <Suspense fallback={null}>
          <MobileNav />
        </Suspense>

      </div>

    </div>
  );
}
