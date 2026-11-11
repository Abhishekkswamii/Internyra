import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/app", "/privacy", "/terms", "/app/reports/insp_missing-0000"];

test.describe("Layout & accessibility regression", () => {
  for (const route of ROUTES) {
    test(`no horizontal overflow on ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("load");
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }

  test("no horizontal overflow with a very long link in the locked shell", async ({ page }) => {
    test.skip(!!process.env.SKIP_AUTH_LAYOUT, "needs emulators");
    await page.goto("/");
    const long = `https://very-long-subdomain-name-for-testing.careers.example.com/${"segment/".repeat(20)}?q=${"x".repeat(200)}`;
    await page.getByLabel("Internship link to check").fill(long);
    await page.getByLabel("Internship link to check").press("Enter");
    await expect(page.getByTestId("locked-shell")).toBeVisible({ timeout: 20_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("primary controls are reachable and usable by keyboard", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard flow checked on desktop");
    await page.goto("/");
    const input = page.getByLabel("Internship link to check");
    for (let i = 0; i < 25 && !(await input.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(input).toBeFocused();
    await page.keyboard.type("https://careers.example.com/x");
    await page.keyboard.press("Enter");
    await expect(page.locator("#guest-preview")).toBeVisible();
    const cancelBtn = page.locator("#guest-preview button", { hasText: "Cancel" });
    await cancelBtn.focus();
    await expect(cancelBtn).toBeFocused();
  });

  test("touch targets on phone-sized screens stay usable", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/app");
    const nav = page.locator("nav.fixed a");
    await expect(nav.last()).toBeVisible();
    const count = await nav.count();
    expect(count).toBe(3);
    for (let i = 0; i < count; i++) {
      const box = await nav.nth(i).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });

  test("reduced-motion preference disables entrance animation and keeps all content visible", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", serviceWorkers: "block" });
    const page = await context.newPage();
    await page.goto("/");
    const styles = await page.evaluate(() => {
      const q = (sel: string) => getComputedStyle(document.querySelector(sel)!);
      return {
        heroAnimation: q(".hero-rise").animationName,
        stageAnimation: q(".hero-stage").animationName,
        revealOpacity: q("#examines .mask-reveal").opacity,
        revealClip: q("#examines .mask-reveal").clipPath,
      };
    });
    expect(styles.heroAnimation).toBe("none");
    expect(styles.stageAnimation).toBe("none");
    expect(styles.revealOpacity).toBe("1");
    expect(styles.revealClip).toBe("none");
    await context.close();
  });
});

test.describe("PWA", () => {
  test("manifest and service worker are served with safe headers", async ({ request }) => {
    const manifest = await (await request.get("/manifest.json")).json();
    expect(manifest.start_url).toBe("/app");
    expect(manifest.display).toBe("standalone");
    // Installability: raster icons at 192 and 512, one of them maskable.
    const sizes = manifest.icons.filter((i: { type: string }) => i.type === "image/png").map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
    for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);

    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBe(true);
    expect(sw.headers()["cache-control"]).toContain("no-cache");
    const body = await sw.text();
    expect(body).toContain('url.pathname.startsWith("/api/")');
    expect(body).toContain('request.method !== "GET"');

    const page = await request.get("/");
    expect(page.headers()["x-frame-options"]).toBe("DENY");
    expect(page.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("with the service worker active, API responses are never cached", async ({ browser, isMobile }) => {
    test.skip(isMobile, "run once");
    const context = await browser.newContext({ serviceWorkers: "allow" });
    const page = await context.newPage();
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.evaluate(() => fetch("/api/status").then((r) => r.json()));
    const cachedApi = await page.evaluate(async () => {
      for (const n of await caches.keys()) {
        const keys = await (await caches.open(n)).keys();
        if (keys.some((k) => new URL(k.url).pathname.startsWith("/api/"))) return true;
      }
      return false;
    });
    expect(cachedApi).toBe(false);
    await context.close();
  });
});
