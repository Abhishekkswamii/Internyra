import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createUserWithToken, logInViaUI, PASSWORD, uniqueEmail } from "./helpers";

// Serious/critical axe violations fail the build. Lesser ones are not asserted here.
async function serious(page: import("@playwright/test").Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target}`);
}

test.describe("automated accessibility (axe)", () => {
  test.use({ reducedMotion: "reduce" }); // axe samples colours; mid-animation opacity gives false contrast results
  for (const route of ["/", "/login", "/signup", "/privacy"]) {
    test(`public page ${route} has no serious or critical violations`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("load");
      expect(await serious(page)).toEqual([]);
    });
  }
  for (const route of ["/app", "/app/verify", "/app/settings"]) {
    test(`core page ${route} has no serious or critical violations`, async ({ page }) => {
      const u = await createUserWithToken(uniqueEmail("axe"), PASSWORD);
      await logInViaUI(page, { email: u.email, path: `/login?next=${encodeURIComponent(route)}` });
      await page.waitForURL(`**${route}`, { timeout: 20_000 });
      await expect(page.locator("main:visible")).toBeVisible();
      expect(await serious(page)).toEqual([]);
    });
  }
});
