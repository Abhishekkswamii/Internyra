import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { AuthProvider } from "@/lib/firebase/auth-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const serif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Internyra — Internship Intelligence & Evidence Verification",
  description: "Check internship links and recruiter messages for common scam patterns, with every finding tied to what was observed and every unavailable check listed.",
  manifest: "/manifest.json",
  icons: {
    icon: "/brand/favicon.svg",
    apple: "/brand/logo-icon.svg",
  },
  openGraph: {
    title: "Internyra — Know what you're applying to.",
    description: "Investigate internship opportunities with evidence, not guesswork.",
    type: "website",
    siteName: "Internyra",
  },
};

export const viewport: Viewport = {
  themeColor: "#f8f7f2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      suppressHydrationWarning
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--canvas)] text-[var(--ink-secondary)]">
        <Script id="js-flag" strategy="beforeInteractive">{"document.documentElement.classList.add('js')"}</Script>
        <AuthProvider>
          {children}
        </AuthProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
