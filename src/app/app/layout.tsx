import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/app/AppShell";

export const metadata: Metadata = {
  title: "Internyra Core — Opportunity Verification Dashboard",
  description: "Run checks on internship links and messages, review findings and evidence, and manage reports saved in this browser.",
};

export default function CoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--canvas)]" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
