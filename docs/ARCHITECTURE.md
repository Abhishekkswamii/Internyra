# Architecture

## Data (Cloud Firestore, asia-southeast1)

| Path | Written by | Purpose |
|---|---|---|
| `users/{uid}` | server | minimal profile: `uid`, `email`, `provider`, `createdAt`, `lastSeenAt` |
| `users/{uid}/inspections/{id}` | server | the owner's inspection and report (status, submission, local `case`, validated `research`, provider/model/fallback/web-search/cache metadata, versions, timestamps, safe error) |
| `inspectionJobs/{id}` | server | queue/status metadata (`ownerUid`, `status`, `attempts`) |
| `usageEvents/{id}` | server | real events only: research runs, cache hit/miss/refresh/error, rate-limit hits, provider errors. No secrets, no message text |
| `adminAuditLogs/{id}` | server | every admin view that is opened |

Inspection statuses: `pending_auth` → `queued` → `running` → `completed` | `failed`. A `running` record carries a lease (`leaseExpiresAt`); a crashed worker's record can be taken over after it expires.

**Security Rules** (`firestore.rules`) are deny-by-default. Clients may read only their own `users/{uid}` tree. **No client writes at all**; every write goes through a server route that verifies the Firebase ID token and uses the Admin SDK. The admin custom claim does not open client access either: admin data is served by `/api/admin/data` after server-side verification. Rules are tested on the emulator (`npm run test:rules`).

**Indexes** (`firestore.indexes.json`):
- Composite, collection-group `inspections (status ASC, createdAt ASC)`: bounded cleanup of abandoned `pending_auth` requests.
- Field override: `inspections.createdAt` ascending/descending (collection) and descending (collection group): paginated history and the admin inspections table.
Everything else uses automatic single-field indexes. Lists are paginated with a `createdAt` cursor.

## Trust boundaries

- **Identity.** The server never trusts a client-supplied UID, email, role or owner. The owner is the verified token's UID. A pending request can only move to another account with proof of the anonymous identity.
- **Admin.** Requires a verified, non-revoked token **and** the `admin` custom claim **and** `uid === ADMIN_UID` **and** a non-anonymous identity. Provisioned once with `npm run admin:claim`.
- **Input.** All submitted text and fetched pages are untrusted data. Prompts fence them in per-request boundary markers, strip look-alike markers, and instruct the model never to follow them; injection attempts are detected heuristically and recorded as a risk indicator.
- **Retrieval.** `src/lib/security/fetch-guard.ts`: http/https only, no credentials, standard ports, every redirect re-validated (max 3), DNS validated *and* the connection pinned to validated public addresses (defends DNS rebinding), 8 s timeout, 1 MB cap, text content types only, robots.txt honoured, no script execution, errors reduced to stable categories.
- **Output.** Strict Zod schema; absolute legitimacy claims are rejected; facts need a source we hold and (for fetched pages) a quote that really appears in it; unsupported facts are dropped and counted.

## Providers

`AI_PROVIDER_ORDER` (default `gemini,openai`), models from env. With Gemini unconfigured the strategy is recorded as `openai_temporary_gemini_not_configured` (not a fallback). With both configured, Gemini runs first and OpenAI is tried once only after a provider-side failure (transient, quota, auth, config). Invalid input and validation failures never fall back, and nothing retries in a loop. Web search is off unless `AI_WEB_SEARCH_ENABLED=true`, and `webSearchUsed` is recorded only if the provider actually searched. `AI_INSPECTIONS_ENABLED=false` is the kill switch.

## Redis (Upstash) — optional

Cache and coordination only; Firestore is authoritative. Cache keys hash the content together with parser, prompt, schema and provider/model strategy versions. Links expire after 6 h, messages after 24 h; a refresh action bypasses the entry. Locks are atomic `SET NX EX` with an ownership token. If Redis is missing or down, rate limits fall back to a per-instance window, locks to a per-instance lock, and analysis runs directly. Every cache cost is counted from real events. A cache hit still creates a separate inspection record for each student.

## Data handling

Pasted message text is removed from the stored record when a run completes (length and a short hash remain). Unclaimed anonymous requests are deleted opportunistically after 24 h (no paid Firestore TTL is used). Account deletion removes the user's Firestore tree and Auth account.
