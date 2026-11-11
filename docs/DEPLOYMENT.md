# Deployment (Firebase App Hosting only)

Project: `internyra-385d6` · Firestore: `asia-southeast1` · App Hosting config: `apphosting.yaml`.
No Vercel configuration exists or is used.

## Owner actions, in order

1. **Authentication providers** (Firebase console → Authentication → Get started → Sign-in method): enable **Email/Password**, **Google** and **Anonymous**. Anonymous is used only to hold a visitor's pending request before sign-up. Add the App Hosting domain to *Authentication → Settings → Authorized domains* after the first rollout.
2. **Restrict the web API key** (Google Cloud console → APIs & Services → Credentials): limit it to your App Hosting domain(s). It is a public identifier, but restricting it is good practice.
3. **Rotate exposed credentials.** The OpenAI key and Upstash REST token that were pasted into earlier chats are compromised. Revoke the OpenAI key and rotate the Upstash token, then create *new* ones. Never paste them into chat or commit them.
4. **Create secrets** (values are typed at the prompt, never on the command line):
   ```bash
   firebase apphosting:secrets:set openai-api-key
   firebase apphosting:secrets:set upstash-redis-rest-url
   firebase apphosting:secrets:set upstash-redis-rest-token
   firebase apphosting:secrets:set gemini-api-key        # when you have it
   ```
   Then uncomment the matching blocks in `apphosting.yaml` and grant the backend access when prompted.
5. **Smoke-test before enabling AI** with your new keys: `npm run smoke:ai` and `npm run smoke:redis`. Only then set `AI_INSPECTIONS_ENABLED` to `"true"` in `apphosting.yaml`. If Gemini is not configured, OpenAI runs as the explicitly recorded temporary provider.
6. **Admin account.** Sign up in the app as yourself (ordinary account), copy your UID from Firebase console → Authentication, set it as the `admin-uid` secret / `ADMIN_UID`, then run `ADMIN_UID=<uid> FIREBASE_PROJECT_ID=internyra-385d6 npm run admin:claim -- <uid>` (needs `gcloud auth application-default login` as the project owner). Enable multi-factor authentication on that account.
7. **Budget alerts** (Google Cloud console → Billing → Budgets & alerts): create a budget with alerts at 50/90/100 %. Alerts are **notifications, not a spending cap**. Check *Cloud Run* and *Firestore* usage in the Firebase console during the trial (credit expires 10 Feb 2027).

## Backend

The App Hosting backend needs a GitHub connection, which the Firebase console / CLI sets up interactively:

```bash
firebase apphosting:backends:create --project internyra-385d6 --backend internyra --primary-region asia-southeast1 --root-dir /
```
Choose repository `Abhishekkswamii/Internyra`, live branch `main`, automatic rollouts on. Every push to `main` then builds and rolls out. Cloud Run limits (`maxInstances: 2`, `minInstances: 0`, `concurrency: 20`) are in `apphosting.yaml`.

## Rules and indexes

```bash
firebase deploy --only firestore --project internyra-385d6
```

## Abandoned-request cleanup

Cleanup of unclaimed anonymous requests runs opportunistically on new submissions. A scheduled job is optional and not configured.
