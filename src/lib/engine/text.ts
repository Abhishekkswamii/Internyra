/**
 * Offline parsing of user-supplied recruiter messages / offer text.
 *
 * The submitted text is untrusted data: it is only pattern-matched, never interpreted
 * as instructions. Everything extracted here is "stated in your submission", not
 * independently corroborated.
 */

import { FREE_EMAIL_DOMAINS, matchHostList } from "./lists";

export const MAX_TEXT_LENGTH = 20_000;
const EXCERPT_RADIUS = 70;

export interface TextMatch {
  /** Short excerpt around the match (never the whole text). */
  excerpt: string;
  matched: string;
}

export interface EmailMention {
  address: string;
  domain: string;
  freeProvider: string | null;
}

export interface TextAnalysis {
  length: number;
  paymentRequests: TextMatch[];
  paymentReassurances: TextMatch[];
  sensitiveDataRequests: TextMatch[];
  offPlatformContact: TextMatch[];
  pressureTactics: TextMatch[];
  emails: EmailMention[];
  compensationClaims: TextMatch[];
  organizationNames: string[];
}

const MAX_SENTENCE_LENGTH = 1_000;

function splitSentences(text: string): { sentence: string; start: number }[] {
  const out: { sentence: string; start: number }[] = [];
  const re = /[^.!?\n]+[.!?]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    // Very long unbroken runs are capped: the amount patterns backtrack quadratically on them.
    if (m[0].trim()) out.push({ sentence: m[0].slice(0, MAX_SENTENCE_LENGTH), start: m.index });
  }
  return out;
}

export function makeExcerpt(text: string, index: number, length: number): string {
  const start = Math.max(0, index - EXCERPT_RADIUS);
  const end = Math.min(text.length, index + length + EXCERPT_RADIUS);
  const body = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
}

const CURRENCY = String.raw`(?:₹|rs\.?|inr|\$|usd|€|eur|£|gbp)`;
const AMOUNT = String.raw`${CURRENCY}\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:rupees|dollars|inr|usd)`;

const PAYMENT_PATTERNS: RegExp[] = [
  /\b(?:registration|application|processing|onboarding|training|joining|security|enrol?ment|certification|interview|verification|background[- ]check|kit|laptop|equipment|uniform|refundable|caution)\s+(?:fee|fees|charges?|deposit|amount|payment)\b/i,
  /\bpay(?:ing)?\s+(?:a|an|the|this|your)?\s*(?:one[- ]time\s+)?(?:fee|deposit|registration|charge)\b/i,
  new RegExp(String.raw`\b(?:pay|transfer|send|deposit|wire|remit)\b[^.!?\n]{0,50}(?:${AMOUNT})`, "i"),
  new RegExp(String.raw`(?:${AMOUNT})[^.!?\n]{0,50}\b(?:fee|deposit|to confirm|to secure|to reserve|before joining|refundable)\b`, "i"),
  /\b(?:must|required to|need to|have to|mandatory to|kindly)\b[^.!?\n]{0,40}\b(?:buy|purchase)\b[^.!?\n]{0,40}\b(?:laptop|equipment|kit|course|software|training|package)\b/i,
  /\b(?:gift\s*cards?|itunes\s+cards?)\b/i,
  /\b(?:deposit|cash)\s+(?:the|this|a)\s+(?:check|cheque)\b/i,
];

// Contrast words split a sentence into clauses that are judged separately.
const CLAUSE_BREAK = /\b(?:but|however|although|though|except|yet)\b|;/i;

const PAYMENT_NEGATION = /\b(?:no|never|not|without|zero|free of)\b[^.!?\n]{0,25}\b(?:fees?|charges?|deposits?|pay|payment|cost)\b|\bfree of (?:cost|charge)\b|\bdo(?:es)? not (?:charge|ask|require)\b/i;
const PAYMENT_TO_STUDENT = /\b(?:pay(?:ing)? you|paid to you|you will (?:be paid|receive|get)|stipend|salary|compensation|ctc)\b/i;
const PAYMENT_STRONG_WORD = /\b(?:fees?|deposit|registration|charges?|gift\s*cards?|cheque|check)\b/i;

const SENSITIVE_PATTERN = /\b(?:bank account (?:number|details)|account number|ifsc|routing number|otp|one[- ]time password|password|upi pin|atm pin|cvv|card (?:number|details)|aadhaa?r(?: number| card)?|pan card|ssn|social security(?: number)?|passport (?:number|copy|scan))\b/i;
const REQUEST_VERB = /\b(?:send|share|provide|submit|need|require[sd]?|upload|enter|fill|forward|give|confirm)\b/i;
const SENSITIVE_NEGATION = /\b(?:never|not|don'?t|do not|won'?t|will not)\b[^.!?\n]{0,40}\b(?:ask|share|request|need)\b/i;

const OFF_PLATFORM_PATTERN = /\b(?:telegram|whatsapp|whats app|wechat|signal app)\b/i;
const PRESSURE_PATTERN = /\b(?:within \d+\s*(?:hours?|hrs?|minutes?|mins?)|immediately|urgent(?:ly)?|limited (?:seats|slots|positions)|last chance|today only|act now|expires? (?:today|tonight)|no interview (?:required|needed)|without (?:an )?interview)\b/i;

const COMPENSATION_PATTERN = new RegExp(
  String.raw`\b(?:stipend|salary|compensation|ctc|pay(?:ment)? of)\b[^.!?\n]{0,40}(?:${AMOUNT}|\d+\s?(?:lpa|k\b))|(?:${AMOUNT})[^.!?\n]{0,25}(?:per month|/month|/mo|per hour|/hr|a month|monthly)`,
  "i"
);

const EMAIL_PATTERN = /\b[a-z0-9._%+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})\b/gi;

const ORG_PATTERN =
  /\b([A-Z][A-Za-z0-9&]+(?:\s+[A-Z][A-Za-z0-9&]+){0,4}\s+(?:Pvt\.?\s+Ltd\.?|Private Limited|LLC|Inc\.?|Ltd\.?|Limited|LLP|Corp\.?|Corporation|GmbH))/g;
const ORG_LABEL_PATTERN = /^(?:company|organi[sz]ation|employer)\s*:\s*([^\n]{2,60})$/gim;

function scanSentences(
  text: string,
  test: (sentence: string) => RegExpExecArray | null,
  limit = 3
): TextMatch[] {
  const out: TextMatch[] = [];
  for (const { sentence, start } of splitSentences(text)) {
    const m = test(sentence);
    if (!m) continue;
    out.push({ matched: m[0], excerpt: makeExcerpt(text, start + m.index, m[0].length) });
    if (out.length >= limit) break;
  }
  return out;
}

function firstMatch(sentence: string, patterns: RegExp[]): RegExpExecArray | null {
  for (const p of patterns) {
    const m = p.exec(sentence);
    if (m) return m;
  }
  return null;
}

export function analyzeText(rawText: string): TextAnalysis {
  const text = rawText.slice(0, MAX_TEXT_LENGTH);

  const paymentReassurances: TextMatch[] = [];
  const paymentRequests = scanSentences(text, (sentence) => {
    // A reassurance only covers its own clause: "There is no application fee, but you must pay a
    // $50 kit fee" still contains a request.
    let request: RegExpExecArray | null = null;
    let offset = 0;
    for (const clause of sentence.split(CLAUSE_BREAK)) {
      const m = firstMatch(clause, PAYMENT_PATTERNS);
      const at = sentence.indexOf(clause, offset);
      offset = at + clause.length;
      if (!m) continue;
      if (PAYMENT_NEGATION.test(clause)) {
        const neg = PAYMENT_NEGATION.exec(clause)!;
        paymentReassurances.push({ matched: neg[0], excerpt: makeExcerpt(clause, neg.index, neg[0].length) });
        continue;
      }
      // "You will receive a stipend of ₹10,000" is compensation, not a payment request.
      if (PAYMENT_TO_STUDENT.test(clause) && !PAYMENT_STRONG_WORD.test(clause)) continue;
      if (!request) {
        // Re-anchor the match to the whole sentence so excerpts point at the right place.
        m.index += at;
        request = m;
      }
    }
    return request;
  });

  const sensitiveDataRequests = scanSentences(text, (sentence) => {
    const m = SENSITIVE_PATTERN.exec(sentence);
    if (!m || !REQUEST_VERB.test(sentence) || SENSITIVE_NEGATION.test(sentence)) return null;
    return m;
  });

  const offPlatformContact = scanSentences(text, (s) => OFF_PLATFORM_PATTERN.exec(s), 2);
  const pressureTactics = scanSentences(text, (s) => PRESSURE_PATTERN.exec(s), 2);
  const compensationClaims = scanSentences(text, (s) => COMPENSATION_PATTERN.exec(s), 2);

  const emails: EmailMention[] = [];
  for (const m of text.matchAll(EMAIL_PATTERN)) {
    const address = m[0].toLowerCase();
    if (emails.some((e) => e.address === address)) continue;
    const domain = m[1].toLowerCase();
    emails.push({ address, domain, freeProvider: matchHostList(domain, FREE_EMAIL_DOMAINS) ?? null });
    if (emails.length >= 5) break;
  }

  const orgs = new Set<string>();
  // A trailing "." is usually the end of the sentence, not part of "Ltd."/"Inc."
  for (const m of text.matchAll(ORG_PATTERN)) orgs.add(m[1].trim().replace(/\.$/, ""));
  for (const m of text.matchAll(ORG_LABEL_PATTERN)) orgs.add(m[1].trim());

  return {
    length: text.length,
    paymentRequests,
    paymentReassurances: paymentReassurances.slice(0, 2),
    sensitiveDataRequests,
    offPlatformContact,
    pressureTactics,
    emails,
    compensationClaims,
    organizationNames: [...orgs].slice(0, 5),
  };
}
