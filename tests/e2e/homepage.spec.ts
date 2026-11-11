import { expect, test } from "@playwright/test";

test.describe("Homepage structure and forensic workflow", () => {
  test("has the core sections in order, plus a compact footer", async ({ page }) => {
    await page.goto("/");
    const order = await page.evaluate(() =>
      ["guest-input", "examines", "workflow", "steps", "faq"].map((id) => document.getElementById(id)!.getBoundingClientRect().top + window.scrollY)
    );
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("the forensic workflow section explains the three verification tiers", async ({ page }) => {
    await page.goto("/#workflow");
    const workflow = page.locator("#workflow");
    await expect(workflow).toBeVisible();
    await expect(workflow.getByText("How Internyra verifies")).toBeVisible();
    await expect(workflow.getByText("1. Structural & Transport Lineage")).toBeVisible();
    await expect(workflow.getByText("2. Language & Financial Demands")).toBeVisible();
    await expect(workflow.getByText("3. Research with sources")).toBeVisible();
  });

  test("the landing page contains no fabricated demo reports or sample buttons", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Sample · fictional input")).toHaveCount(0);
    await expect(page.getByText("Lookalike link")).toHaveCount(0);
    await expect(page.getByText("Social post")).toHaveCount(0);
  });

  test("the closing call to action focuses the checker", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Check an internship" }).click();
    await expect(page.getByLabel("Internship link to check")).toBeFocused();
  });

  test("the FAQ is compact and keyboard accessible", async ({ page }) => {
    await page.goto("/");
    const items = page.locator("#faq details");
    expect(await items.count()).toBeLessThanOrEqual(5);
    await page.locator("#faq summary").first().focus();
    await page.keyboard.press("Enter");
    await expect(items.first()).toHaveAttribute("open", "");
  });

  test("original photography loads with alt text and reserves its space", async ({ page }) => {
    await page.goto("/");
    const hero = page.getByRole("img", { name: /precision optical inspection instrument/i });
    await expect(hero).toBeVisible();
    await expect.poll(() => hero.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

    const desk = page.getByRole("img", { name: /printed offer letter on a stone desk/i });
    await desk.scrollIntoViewIfNeeded();
    await expect.poll(() => desk.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

    const evidence = page.locator("#workflow").getByRole("img");
    await evidence.scrollIntoViewIfNeeded();
    await expect.poll(() => evidence.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  });

  test("phones get the plain three-step list instead of the 3D scene", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone only");
    await page.goto("/");
    await page.locator("#steps").scrollIntoViewIfNeeded();
    await expect(page.locator("#steps li:visible")).toHaveCount(3);
    await expect(page.locator("canvas")).toHaveCount(0);
  });
});
