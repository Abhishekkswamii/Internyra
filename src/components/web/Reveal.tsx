"use client";

import React, { useEffect, useRef } from "react";

type Variant = "reveal" | "mask-reveal";

/**
 * Adds `is-in` once the element scrolls into view. The CSS only hides content when JS is running
 * and reduced motion is not requested, so the content is always reachable without animation.
 * (The mask keeps a sliver visible: browsers do not report a fully clipped element as intersecting.)
 */
export function Reveal({
  as: Tag = "div",
  variant = "reveal",
  delay = 0,
  className = "",
  children,
  ...rest
}: {
  as?: React.ElementType;
  variant?: Variant;
  delay?: number;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`${variant} ${className}`}
      style={{ ["--reveal-delay" as string]: `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
