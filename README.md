# Internyra

Helps students investigate internship links, recruiter messages and offer text before they pay or share anything. A visitor submits a link or pastes a message; after signing in, Internyra runs local rule checks and AI research and saves an evidence-backed report to the student's private account.

> Internyra is research support, not a certification. It never says an offer is "safe" or "100% legitimate". Every fact in a report is tied to a retrieved source; anything that cannot be sourced is shown as unverified.

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind 4 · Firebase Authentication · Cloud Firestore · Upstash Redis (cache and locks only) · Google Gemini (primary) with an OpenAI fallback · Firebase App Hosting.

## How it works

1. A visitor submits a link or message. A short-lived **anonymous Firebase identity** saves a real `pending_auth` inspection in Firestore. No AI runs and nothing is analysed. The page shows a locked shell with the five real section headings only.
2. Signing up **upgrades that same identity** in place (so the pending request stays with the same UID). Signing in to an *existing* account claims the request only when the caller proves they hold the anonymous identity (`X-Anonymous-Token`); both tokens are verified on the server.
3. The inspection becomes `queued`. `POST /api/inspections/{id}/run` takes an atomic lease, runs the local engine, then research: fetch the linked page through an SSRF-hardened fetcher, call Gemini first (one OpenAI fallback for provider-side failures only), validate the output against a strict schema, and keep a fact only if its quote appears in a source Internyra actually holds.
4. The report is stored under `users/{uid}/inspections/{id}` and survives refresh, logout and other devices.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model, security model and indexes, and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Firebase setup, secrets and the exact owner actions.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the public Firebase web config; leave AI_INSPECTIONS_ENABLED=false
npm run dev                  # http://localhost:3000
```

## Commands

| Command | What it does |
|---|---|
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm test` | Vitest unit and route tests (`tests/unit`) |
| `npm run test:rules` | Firestore Security Rules tests on the Firestore emulator |
| `npm run test:e2e` | Playwright against a production build, with the Auth + Firestore emulators |
| `npm run build` | Production build |
| `npm run smoke:ai` | Opt-in: one tiny request per configured AI provider (uses your *new* keys; prints no secrets) |
| `npm run smoke:redis` | Opt-in: PING, TTL and lock checks against your Upstash database |
| `ADMIN_EMAIL=… npm run admin:claim` | One-time: finds the (verified, non-anonymous) admin account, grants the claim and prints its UID for `ADMIN_UID` |

Emulator-based commands need Java and download the emulators on first use.

## Routes

- `/` landing page and the visitor checker
- `/auth?mode=signup|login`, `/signup`, `/login` authentication (Google, email/password, password reset); `?next=` accepts internal `/app...` paths only
- `/app` student dashboard (sign-in required) · `/app/verify` new inspection · `/app/reports/[id]` report or live status · `/app/settings` account, data notice, account deletion
- `/app/admin` single-admin dashboard (server-verified)
- `/privacy`, `/terms`
- API: `/api/inspections` (create/list), `/api/inspections/[id]` (read/delete), `/api/inspections/[id]/run`, `/api/inspections/claim`, `/api/user/account` (delete), `/api/admin/data`, `/api/status`

## Secrets

Never commit `.env*`, service-account files or tokens. Server secrets are not `NEXT_PUBLIC_`. On App Hosting they live in Secret Manager.
