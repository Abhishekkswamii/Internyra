# Deployment (Firebase App Hosting only)

Project: `internyra-385d6` · Firestore: `asia-southeast1` · App Hosting config: `apphosting.yaml`.
No Vercel configuration exists or is used.

## Owner actions, in order

1. **Authorized domain for Google sign-in.** Email/Password and Anonymous sign-in are enabled from `firebase.json` (`firebase deploy --only auth`), as is the Google provider. Google's popup additionally requires the App Hosting domain to be listed: Firebase console → Authentication → Settings → Authorized domains → add `internyra--internyra-385d6.asia-southeast1.hosted.app` (and any custom domain). Until then Google sign-in is rejected with `auth/unauthorized-domain`; email sign-up is unaffected.
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

The backend `internyra` exists in `asia-southeast1` and is rolled out from local source:

```bash
firebase deploy --only apphosting --project internyra-385d6   # uploads source (see the ignore list in firebase.json; .env* is excluded) and rolls out
```
It is **not yet connected to GitHub**: the connection needs a browser OAuth step that the CLI cannot complete. To get automatic rollouts on every push to `main`: Firebase console → App Hosting → `internyra` → Settings → Deployment → Connect to GitHub → repository `Abhishekkswamii/Internyra`, live branch `main`, automatic rollouts on. Cloud Run limits (`maxInstances: 2`, `minInstances: 0`, `concurrency: 20`) are in `apphosting.yaml`.

## Rules and indexes

```bash
firebase deploy --only firestore --project internyra-385d6
```

## Abandoned-request cleanup

Cleanup of unclaimed anonymous requests runs opportunistically on new submissions. A scheduled job is optional and not configured.
