import type { Metadata } from "next";
import { Suspense } from "react";
import { ProtectedApp } from "@/components/app/ProtectedApp";

export const metadata: Metadata = {
  title: "Internyra Core — Opportunity Verification Dashboard",
  description: "Run checks on internship links and messages, review findings and evidence, and manage your saved reports.",
};

export default function CoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--canvas)]" />}>
      <ProtectedApp>{children}</ProtectedApp>
    </Suspense>
  );
}
