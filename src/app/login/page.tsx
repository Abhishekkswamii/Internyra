import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthExperience } from "@/components/auth/AuthExperience";

export const metadata: Metadata = {
  title: "Log in — Internyra",
  description: "Log in or create an Internyra account.",
  robots: { index: false },
};

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--canvas)]" />}>
      <AuthExperience initialMode={"login"} />
    </Suspense>
  );
}
