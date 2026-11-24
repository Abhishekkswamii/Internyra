/**
 * Internyra Design System Tokens
 * Canonical definitions for palette, elevation, layout, and component aesthetics.
 * Matches warm ivory, deep ink, and cobalt accents.
 */

export const DESIGN_TOKENS = {
  colors: {
    canvas: {
      default: "#f8f7f2",
      subtle: "#e9e7e0",
      accent: "#eef1ff",
    },
    surface: {
      0: "#ffffff",
      1: "#fbfbfa",
      2: "#f4f2eb",
      hover: "#f1eee6",
      accent: "#eef1ff",
    },
    ink: {
      primary: "#151925",
      secondary: "#424857",
      muted: "#5f6678",
      faint: "#a4abb8",
    },
    brand: {
      primary: "#345dff",
      secondary: "#2447d6",
      accent: "#6488ff",
      glow: "rgba(52, 93, 255, 0.08)",
      citrus: "#d8ee70",
    },
    border: {
      light: "#e5e4de",
      subtle: "#edece6",
      focus: "#345dff",
    },
    status: {
      safe: {
        bg: "#edf7f2",
        text: "#1b7340",
        border: "#c6e9d5",
        dot: "#22a05b",
      },
      risk: {
        bg: "#fdf1f0",
        text: "#b82c24",
        border: "#f7cac7",
        dot: "#de3b31",
      },
      review: {
        bg: "#fef7ec",
        text: "#9e5b0e",
        border: "#fce1b6",
        dot: "#d97706",
      },
      insufficient: {
        bg: "#f4f3ef",
        text: "#5c6270",
        border: "#dddcd6",
        dot: "#8e95a5",
      },
    },
  },
  shadows: {
    card: "0 1px 3px rgba(21, 25, 37, 0.04), 0 4px 12px rgba(21, 25, 37, 0.02)",
    cardHover: "0 4px 20px -4px rgba(21, 25, 37, 0.08), 0 2px 6px -1px rgba(21, 25, 37, 0.04)",
    dialog: "0 24px 60px -12px rgba(21, 25, 37, 0.25), 0 12px 24px -8px rgba(21, 25, 37, 0.15)",
    popover: "0 10px 30px -5px rgba(21, 25, 37, 0.12)",
  },
  radii: {
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    full: "9999px",
  },
} as const;

export type DesignTokens = typeof DESIGN_TOKENS;
