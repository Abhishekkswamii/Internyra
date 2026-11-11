import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_ADMIN = { uid: "e2e-admin-uid", email: "admin@e2e.test", password: "e2e-admin-pass-1" };

// The app under test talks only to the Firebase Auth + Firestore EMULATORS (npm run test:e2e starts them).
// No real Firebase project, AI provider or Redis is contacted; AI is switched off so inspections stay queued.
const appEnv: Record<string, string> = {
  NEXT_DIST_DIR: ".next-e2e",
  NEXT_PUBLIC_FIREBASE_API_KEY: "e2e-not-a-real-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "localhost",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-internyra",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:1:web:e2e",
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_PROJECT_ID: "demo-internyra",
  FIREBASE_CLIENT_EMAIL: "",
  FIREBASE_PRIVATE_KEY: "",
  ADMIN_UID: E2E_ADMIN.uid,
  AI_INSPECTIONS_ENABLED: "false",
  GEMINI_API_KEY: "",
  OPENAI_API_KEY: "",
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
};

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false, // tests share one emulator; keep ordering deterministic
  workers: 2,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, serviceWorkers: "block", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 740 } } },
  ],
  webServer: {
    command: process.env.E2E_REUSE_BUILD ? `npx next start -p ${PORT}` : `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: { ...(process.env as Record<string, string>), ...appEnv },
  },
});
