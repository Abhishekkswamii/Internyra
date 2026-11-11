import React from "react";
import Link from "next/link";

interface LogoProps {
  variant?: "icon" | "full" | "horizontal";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  theme?: "light" | "dark" | "auto";
  asLink?: boolean;
  href?: string;
}

export function Logo({
  variant = "full",
  size = "md",
  className = "",
  theme = "light",
  asLink = true,
  href = "/",
}: LogoProps) {
  // Dimensions
  const dimensions = {
    sm: { icon: 24, fullW: 130, fullH: 28, text: "text-lg", dot: 2 },
    md: { icon: 32, fullW: 160, fullH: 36, text: "text-xl", dot: 2.5 },
    lg: { icon: 40, fullW: 185, fullH: 42, text: "text-2xl", dot: 3 },
    xl: { icon: 48, fullW: 220, fullH: 48, text: "text-3xl", dot: 3.5 },
  }[size];

  const isDark = theme === "dark";
  const textColor = isDark ? "text-slate-50" : "text-slate-900";

  const IconSvg = (
    <svg
      width={dimensions.icon}
      height={dimensions.icon}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform duration-300 group-hover:scale-105"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`nyraGrad-${size}`} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="50%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id={`nyraCore-${size}`} x1="16" y1="12" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      
      {/* Upper Aperture Arc */}
      <path
        d="M24 4C35.0457 4 44 12.9543 44 24C44 27.8 42.94 31.35 41.1 34.4L37.2 31.8C38.48 29.5 39.2 26.85 39.2 24C39.2 15.6 32.4 8.8 24 8.8C18.6 8.8 13.9 11.65 11.2 15.9L7.4 13C10.9 7.6 17 4 24 4Z"
        fill={`url(#nyraGrad-${size})`}
        opacity="0.95"
      />
      {/* Lower Aperture Arc */}
      <path
        d="M24 44C12.9543 44 4 35.0457 4 24C4 20.2 5.06 16.65 6.9 13.6L10.8 16.2C9.52 18.5 8.8 21.15 8.8 24C8.8 32.4 15.6 39.2 24 39.2C29.4 39.2 34.1 36.35 36.8 32.1L40.6 35C37.1 40.4 31 44 24 44Z"
        fill={`url(#nyraGrad-${size})`}
        opacity="0.75"
      />
      {/* Forward Trajectory / Focal Wedge */}
      <path
        d="M19 14.5L30 24L19 33.5V28L24.5 24L19 20V14.5Z"
        fill={`url(#nyraCore-${size})`}
      />
      {/* Focus Dot */}
      <circle cx="33.5" cy="24" r="2.5" fill="#3b82f6" />
    </svg>
  );

  const Content = (
    <div className={`inline-flex items-center gap-2.5 font-sans select-none ${className}`}>
      {IconSvg}
      {variant !== "icon" && (
        <span className="inline-flex items-baseline tracking-tight font-bold">
          <span className={`${dimensions.text} ${textColor} font-extrabold tracking-[-0.03em]`}>
            Internyra
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 ml-0.5 translate-y-[-1px]"></span>
        </span>
      )}
    </div>
  );

  if (asLink) {
    return (
      <Link href={href} aria-label={variant === "icon" ? "Internyra home" : undefined} className="group inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg p-1">
        {Content}
      </Link>
    );
  }

  return Content;
}
