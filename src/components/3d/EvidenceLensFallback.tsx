import React from "react";

export const INSTRUMENT_LABEL = "Internyra Evidence Instrument illustration";

/**
 * Static stand-in used while the 3D scene loads, with reduced motion, and when WebGL is unavailable.
 * Kept in its own file so importing it does not pull three.js into the main bundle.
 */
export function EvidenceLensFallback({ className = "" }: { className?: string }) {
  return (
    <div className={`relative grid place-items-center overflow-hidden ${className}`} role="img" aria-label={INSTRUMENT_LABEL}>
      <svg viewBox="0 0 400 440" className="h-full max-h-[520px] w-full select-none" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="ev-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9db5ff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#345dff" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <path d="M70 70 L70 380 M330 70 L330 380" stroke="#9aa3b8" strokeOpacity="0.5" strokeWidth="3" />
        <g transform="translate(-26 16)">
          <rect x="108" y="76" width="190" height="250" rx="10" fill="url(#ev-glass)" stroke="#aab7e6" strokeOpacity="0.6" />
          <path d="M132 120h110M132 142h140M132 164h90" stroke="#c9d4ff" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
        </g>
        <rect x="120" y="92" width="160" height="214" rx="6" fill="#f8f7f2" />
        <g stroke="#c8c6bd" strokeWidth="5" strokeLinecap="round">
          <path d="M142 124h70M142 148h116M142 168h104M142 188h116M142 208h60M142 248h96M142 268h74" />
        </g>
        <path d="M142 188h116" stroke="#d8ee70" strokeWidth="9" strokeLinecap="round" strokeOpacity="0.9" />
        <path d="M142 208h60" stroke="#345dff" strokeWidth="5" strokeLinecap="round" strokeOpacity="0.85" />
        <g transform="translate(26 -10)">
          <rect x="108" y="76" width="190" height="250" rx="10" fill="url(#ev-glass)" stroke="#d6dfff" strokeOpacity="0.8" />
          <rect x="134" y="104" width="138" height="14" rx="7" stroke="#d6dfff" strokeOpacity="0.9" />
        </g>
        <g transform="translate(236 292)">
          <circle r="62" fill="#345dff" fillOpacity="0.1" stroke="#dfe5f5" strokeWidth="9" />
          <circle r="62" stroke="#151925" strokeOpacity="0.5" strokeWidth="2" />
          <circle r="50" stroke="#6488ff" strokeOpacity="0.8" strokeWidth="1.5" />
          <path d="M-36 -22 A44 44 0 0 1 8 -44" stroke="#fff" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
