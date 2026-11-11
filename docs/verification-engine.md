# Verification engine (local deterministic checks)

Code: `src/lib/engine/` (pure TypeScript, no React/Next imports, so it can move to a background worker).
Model: `src/types/verification.ts`. It runs inside the authenticated inspection pipeline (`src/lib/pipeline/run-inspection.ts`) and its result is stored as the inspection's `case`; AI research is a separate, validated `research` block (see ARCHITECTURE.md).

Engine `0.1.1`, ruleset `2026.10.2`, local lists `2026-10-19` (`version.ts`).

## Flow

1. `validateVerificationRequest` checks the untrusted body (kind, lengths, URL validity).
2. `runVerification` runs each check, records a `CheckResult` for **every** known check (completed, unavailable, not run, failed), and builds findings and evidence with links in both directions.
3. `evaluateAssessment` (rules.ts) groups risk signals by `signalGroup`, so one underlying signal is counted once, and applies ASSESS-1…6.
4. `buildNarrative` (explain.ts) writes the summary and next steps from templates. No AI is used.

The engine itself is pure and makes **no outbound network requests**; page retrieval and AI research happen in the pipeline, not here.

## Checks

| Check | Status in this build |
|---|---|
| `input.url` link validation & normalization | runs (http/https only; rejects credentials, whitespace, single-label hosts) |
| `url.structure` | runs: plain http, IP literal (+ range class), non-standard port, shortener list, IDN / mixed-script, job-platform list |
| `domain.lookalike` | runs only when a claimed company name is supplied and the host isn't an IP or shared platform |
| `content.*` (payment, sensitive data, chat-app/pressure, entities) | runs only when text is supplied |
| `recruiter.domain-match` | **unavailable** unless a corroboration source supplies official domains |
| `company.corroboration` | **unavailable**: adapter exists (`corroboration.ts`), no provider registered |
| `domain.registration`, `domain.dns`, `domain.tls`, `page.fetch`, `reputation.threat-intel` | **unavailable**: no provider, and no outbound fetching |

## Assessment rules

| ID | Condition | Result |
|---|---|---|
| ASSESS-1 | any HIGH group (payment request, official contradiction) | HIGH_RISK (MODERATE; HIGH if official or ≥2 independent groups) |
| ASSESS-2 | any MEDIUM group | NEEDS_REVIEW |
| ASSESS-3 | ≥2 LOW groups and no official confirmation | NEEDS_REVIEW (LOW) |
| ASSESS-4 | official confirmation, nothing above | LOWER_CONCERN (MODERATE) |
| ASSESS-5 | ≥80 chars of text analysed, nothing above | INSUFFICIENT_DATA (no confidence; rationale records what was scanned) |
| ASSESS-6 | otherwise | INSUFFICIENT_DATA (no confidence) |

A clean URL alone is always INSUFFICIENT_DATA, and so is clean text: not finding known warning patterns is not evidence of legitimacy. LOWER_CONCERN is only reachable through an official corroboration (ASSESS-4), which no provider supplies yet, so this build never returns it. A social-media link (URL-011) without other signals is INSUFFICIENT_DATA. No numeric score is produced, because nothing would calibrate it.

If a step throws internally, every check it owns that hasn't recorded a result is marked FAILED and the case lifecycle becomes PARTIAL, so coverage never silently omits a check.

### Changelog

- `0.1.1` / `2026.10.2`: ASSESS-5 returns INSUFFICIENT_DATA instead of LOWER_CONCERN; the summary no longer says "no warning" when weak signals were noted; social-media wording no longer makes claims about what posts contain; internal failures mark all owned checks FAILED.

## Before enabling outbound fetches (page content, redirects, RDAP, DNS)

These checks must not be enabled until a server-only fetch guard exists that:

- resolves DNS itself and rejects any non-public address (`src/lib/security/ip.ts`: `isPublicIp`), then **connects to the validated IP** (pinning), which defeats DNS rebinding;
- follows redirects manually (max ~5), re-validating scheme, host and resolved IP on every hop;
- enforces connect/total timeouts, a response-size cap, and a content-type allowlist; never executes HTML/JS;
- sends no cookies, auth headers or internal headers; is unreachable from browser code;
- logs only metadata (see `src/lib/logging.ts`).

Node's built-in `fetch` does not expose IP pinning, so this needs a custom `undici` dispatcher/`lookup` hook and a security review.

## Adding an AI explanation later

Implement `ExplanationProvider` (explain.ts). Its output may only rephrase existing findings: validate that every cited ID exists in `report.findings`/`report.evidence`, and reject any new URL or claim. Treat submitted text as data, never as instructions. Keep secrets out of `NEXT_PUBLIC_*`.
