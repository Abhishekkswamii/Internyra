/**
 * Browser-safe configuration. Only NEXT_PUBLIC_* values (public Firebase web identifiers) are read here.
 * This file must never import or reference any server-side setting.
 */

/** Values that mean "not configured": empty, template placeholders, or obvious dummy text. */
export function isPlaceholder(value: string | undefined | null): boolean {
  if (value === undefined || value === null) return true;
  const v = value.trim();
  if (v === "") return true;
  return /^(your_|<|replace|changeme|todo|xxx)/i.test(v) || /^\.{3}$/.test(v);
}

const clean = (v: string | undefined) => (isPlaceholder(v) ? "" : (v as string).trim());

export function getClientConfig() {
  return {
    apiKey: clean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: clean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    appId: clean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  };
}
