/**
 * Minimal RFC 3492 punycode decoder for displaying internationalized hostnames.
 * Runs in both browser and server code (no `node:` imports).
 */

const BASE = 36;
const T_MIN = 1;
const T_MAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;
const MAX_CODE_POINT = 0x10ffff;

function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  let d = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
  d += Math.floor(d / numPoints);
  let k = 0;
  while (d > ((BASE - T_MIN) * T_MAX) >> 1) {
    d = Math.floor(d / (BASE - T_MIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - T_MIN + 1) * d) / (d + SKEW));
}

function digitValue(cp: number): number {
  if (cp >= 0x30 && cp <= 0x39) return cp - 22; // 0-9 → 26-35
  if (cp >= 0x41 && cp <= 0x5a) return cp - 0x41; // A-Z
  if (cp >= 0x61 && cp <= 0x7a) return cp - 0x61; // a-z
  return BASE;
}

/** Decodes one punycode label body (without the "xn--" prefix). Returns null when invalid. */
export function decodePunycodeLabel(input: string): string | null {
  const output: number[] = [];
  const basicEnd = input.lastIndexOf("-");
  for (let j = 0; j < Math.max(basicEnd, 0); j++) {
    const cp = input.charCodeAt(j);
    if (cp >= 0x80) return null;
    output.push(cp);
  }

  let n = INITIAL_N;
  let bias = INITIAL_BIAS;
  let i = 0;
  for (let idx = basicEnd > 0 ? basicEnd + 1 : 0; idx < input.length; ) {
    const oldi = i;
    let w = 1;
    for (let k = BASE; ; k += BASE) {
      if (idx >= input.length) return null;
      const digit = digitValue(input.charCodeAt(idx++));
      if (digit >= BASE) return null;
      i += digit * w;
      if (i > MAX_CODE_POINT * 64) return null;
      const t = k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias;
      if (digit < t) break;
      w *= BASE - t;
    }
    bias = adapt(i - oldi, output.length + 1, oldi === 0);
    n += Math.floor(i / (output.length + 1));
    i %= output.length + 1;
    if (n > MAX_CODE_POINT) return null;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
}

/** Converts an ASCII hostname to its Unicode display form. Undecodable labels are left as-is. */
export function hostnameToUnicode(hostname: string): string {
  return hostname
    .split(".")
    .map((label) => {
      if (!label.startsWith("xn--")) return label;
      return decodePunycodeLabel(label.slice(4)) ?? label;
    })
    .join(".");
}

export type ScriptName = "latin" | "cyrillic" | "greek" | "other";

function scriptOf(ch: string): ScriptName | null {
  if (/[a-z]/i.test(ch) || /\p{Script=Latin}/u.test(ch)) return "latin";
  if (/\p{Script=Cyrillic}/u.test(ch)) return "cyrillic";
  if (/\p{Script=Greek}/u.test(ch)) return "greek";
  if (/[0-9-]/.test(ch)) return null; // script-neutral
  return "other";
}

/**
 * True when a single label mixes Latin with Cyrillic or Greek letters, a common
 * homograph technique (e.g. Latin "goog" + Cyrillic "le").
 */
export function hasMixedConfusableScripts(label: string): boolean {
  const scripts = new Set<ScriptName>();
  for (const ch of label) {
    const s = scriptOf(ch);
    if (s) scripts.add(s);
  }
  return scripts.has("latin") && (scripts.has("cyrillic") || scripts.has("greek"));
}
