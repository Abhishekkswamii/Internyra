import { defineConfig } from "vitest/config";

// Firestore Security Rules tests. Run through the emulator: npm run test:rules
export default defineConfig({
  test: { environment: "node", include: ["tests/rules/**/*.test.ts"], testTimeout: 20_000, hookTimeout: 30_000 },
});
