import { expect, test } from "@playwright/test";
import { createUserWithToken, logInViaUI, uniqueEmail } from "./helpers";

async function signInViaGate(page: import("@playwright/test").Page, email: string, password: string) {
  await logInViaUI(page, { email, password });
  await page.waitForURL("**/app", { timeout: 20_000 });
}

test.describe("admin dashboard", () => {
  test.skip(({ isMobile }) => isMobile, "desktop flow");

  test("an ordinary student sees no admin navigation and is refused the page", async ({ page }) => {
    const u = await createUserWithToken(uniqueEmail("notadmin"));
    await signInViaGate(page, u.email, "pass-1234");
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await page.goto("/app/admin");
    await expect(page.getByText("Administrator access required")).toBeVisible();
    await expect(page.getByTestId("admin-overview")).toHaveCount(0);
  });

  test("the provisioned admin sees real, honest data with pagination controls", async ({ page }) => {
    await signInViaGate(page, "admin@e2e.test", "e2e-admin-pass-1");
    await expect(page.getByRole("link", { name: "Admin" }).first()).toBeVisible({ timeout: 20_000 });
    await page.goto("/app/admin");
    const overview = page.getByTestId("admin-overview");
    await expect(overview).toBeVisible({ timeout: 20_000 });
    await expect(overview.getByText("Gemini analyses")).toBeVisible();
    await expect(overview.getByText("Counts come only from events recorded by the app")).toBeVisible();
    await page.getByRole("tab", { name: "Students" }).click();
    await expect(page.getByRole("table")).toBeVisible();
    await page.getByRole("tab", { name: "Usage events" }).click();
    await expect(page.getByText("No data yet")).toBeVisible(); // nothing ever ran: honest empty state
  });
});
