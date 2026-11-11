/**
 * Small, hand-maintained local reference lists (see LOCAL_LISTS_VERSION).
 * Matching one of these is an observation, never proof of anything on its own.
 */

/** Public URL-shortening services. Shortened links hide their real destination. */
export const URL_SHORTENER_HOSTS = [
  "bit.ly",
  "bit.do",
  "buff.ly",
  "cutt.ly",
  "goo.gl",
  "is.gd",
  "lnkd.in",
  "ow.ly",
  "rb.gy",
  "rebrand.ly",
  "s.id",
  "shorturl.at",
  "t.co",
  "t.ly",
  "tiny.cc",
  "tinyurl.com",
  "v.gd",
];

/** Job boards and applicant-tracking systems where many employers host listings. */
export const JOB_PLATFORM_HOSTS = [
  "angel.co",
  "ashbyhq.com",
  "foundit.in",
  "glassdoor.com",
  "greenhouse.io",
  "indeed.com",
  "internshala.com",
  "joinhandshake.com",
  "lever.co",
  "linkedin.com",
  "myworkdayjobs.com",
  "naukri.com",
  "smartrecruiters.com",
  "unstop.com",
  "wellfound.com",
  "workable.com",
];

/** Social media and short-video hosting domains that lack primary employer ATS data. */
export const SOCIAL_MEDIA_HOSTS = [
  "facebook.com",
  "fb.com",
  "fb.watch",
  "instagram.com",
  "reddit.com",
  "t.me",
  "telegram.me",
  "telegram.org",
  "threads.net",
  "tiktok.com",
  "twitter.com",
  "whatsapp.com",
  "x.com",
  "youtu.be",
  "youtube.com",
];

/** Consumer email providers where anyone can create an address. */
export const FREE_EMAIL_DOMAINS = [
  "aol.com",
  "gmail.com",
  "gmx.com",
  "googlemail.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "mail.com",
  "outlook.com",
  "proton.me",
  "protonmail.com",
  "rediffmail.com",
  "yahoo.co.in",
  "yahoo.com",
  "yandex.com",
  "zoho.com",
];

/**
 * Multi-label public suffixes we know about. This is NOT the full Public Suffix List;
 * registrable-domain detection for other suffixes falls back to the last two labels.
 */
export const MULTI_LABEL_SUFFIXES = [
  "ac.in",
  "ac.uk",
  "co.in",
  "co.jp",
  "co.nz",
  "co.uk",
  "co.za",
  "com.au",
  "com.br",
  "com.sg",
  "edu.in",
  "gov.in",
  "net.in",
  "org.in",
  "org.uk",
];

/** True when `hostname` equals `base` or is a subdomain of it. */
export function hostMatches(hostname: string, base: string): boolean {
  return hostname === base || hostname.endsWith(`.${base}`);
}

export function matchHostList(hostname: string, list: readonly string[]): string | undefined {
  return list.find((base) => hostMatches(hostname, base));
}

/** Best-effort registrable domain (eTLD+1) using MULTI_LABEL_SUFFIXES. */
export function registrableDomain(hostname: string): string {
  const labels = hostname.split(".");
  if (labels.length <= 2) return hostname;
  const lastTwo = labels.slice(-2).join(".");
  if (MULTI_LABEL_SUFFIXES.includes(lastTwo)) return labels.slice(-3).join(".");
  return lastTwo;
}
