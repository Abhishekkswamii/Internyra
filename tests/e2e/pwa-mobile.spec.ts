import { expect, test, type Page } from "@playwright/test";
import { createUserWithToken, logInViaUI, PASSWORD, uniqueEmail } from "./helpers";

const VIEWPORTS = [
  [320, 568], [360, 740], [375, 812], [390, 844], [412, 915], [430, 932], [768, 1024],
] as const;

async function login(page: Page, who: "student" | "admin" = "student") {
  if (who === "admin") {
    await logInViaUI(page, { email: "admin@e2e.test", password: "e2e-admin-pass-1" });
  } else {
    const u = await createUserWithToken(uniqueEmail("pwa"), PASSWORD);
    await logInViaUI(page, { email: u.email });
  }
  await page.waitForURL("**/app", { timeout: 20_000 });
}
const bottom = (page: Page) => page.locator('[data-testid="bottom-nav"]:visible');

test.describe("manifest and icons", () => {
  test("manifest is valid and every icon is a real image of the declared size", async ({ request }) => {
    const m = await (await request.get("/manifest.json")).json();
    expect(m.name).toBe("Internyra");
    expect(m.short_name).toBe("Internyra");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/app");
    expect(m.scope).toBe("/");
    expect(m.theme_color).toMatch(/^#/);
    expect(m.background_color).toMatch(/^#/);
    expect(m.description).toBeTruthy();
    for (const icon of m.icons.filter((i: { type: string }) => i.type === "image/png")) {
      const res = await request.get(icon.src);
      expect(res.status()).toBe(200);
      const b = await res.body();
      expect(b.subarray(1, 4).toString()).toBe("PNG");
      const [w, h] = [b.readUInt32BE(16), b.readUInt32BE(20)];
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
    expect(m.icons.some((i: { purpose: string; sizes: string }) => i.purpose === "maskable" && i.sizes === "512x512")).toBe(true);
  });

  test("apple touch icon is 180x180 and iOS standalone metadata is present", async ({ request, page }) => {
    const b = await (await request.get("/brand/apple-touch-icon.png")).body();
    expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([180, 180]);
    await page.goto("/");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon\.png/);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]').first()).toHaveAttribute("content", "yes");
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
  });

  test("offline page is served and makes no false claims", async ({ request }) => {
    const t = await (await request.get("/offline.html")).text();
    expect(t).toContain("Nothing is being analysed while you are offline");
  });
});

test.describe("mobile navigation", () => {
  test.skip(({ isMobile }) => !isMobile, "phone layout");

  test("bottom tabs: three tabs, fixed, safe-area aware, correct active tab, back/forward, refresh", async ({ page }) => {
    await login(page);
    const nav = bottom(page);
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(3);
    await expect(page.locator('aside:visible')).toHaveCount(0);
    expect(await nav.evaluate((el) => getComputedStyle(el).position)).toBe("fixed");
    expect(await nav.evaluate((el) => (el as HTMLElement).style.paddingBottom)).toContain("safe-area-inset-bottom");
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/app\/verify$/);
    await expect(nav.getByRole("link", { name: "Verify" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("mobile-title").locator("visible=true")).toHaveText("New inspection");
    await nav.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/app\/settings$/);
    await expect(nav.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");

    await page.goBack();
    await expect(page).toHaveURL(/\/app\/verify$/);
    await expect(nav.getByRole("link", { name: "Verify" })).toHaveAttribute("aria-current", "page");
    await page.goForward();
    await expect(page).toHaveURL(/\/app\/settings$/);
    await page.reload();
    await expect(bottom(page)).toBeVisible({ timeout: 20_000 });
    await expect(bottom(page).getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  });

  test("touch targets are at least 44px and the last content is never hidden behind the bar", async ({ page }) => {
    await login(page);
    for (const l of await bottom(page).getByRole("link").all()) {
      const b = (await l.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.width).toBeGreaterThanOrEqual(44);
    }
    await page.goto("/app/settings");
    await expect(page.getByRole("heading", { name: "Settings" }).locator("visible=true")).toBeVisible({ timeout: 20_000 });
    await page.locator("main:visible").evaluate((m) => (m.lastElementChild as HTMLElement).scrollIntoView({ block: "end" }));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(200);
    const navTop = (await bottom(page).boundingBox())!.y;
    const mainBottom = await page.locator("main:visible").evaluate((m) => (m.lastElementChild as HTMLElement).getBoundingClientRect().bottom);
    expect(mainBottom).toBeLessThanOrEqual(navTop + 1);
  });

  test("a student has no Admin tab", async ({ page }) => {
    await login(page);
    await expect(bottom(page).getByRole("link", { name: "Admin" })).toHaveCount(0);
  });

  test("the verified admin gets an Admin tab", async ({ page }) => {
    await login(page, "admin");
    await expect(bottom(page).getByRole("link")).toHaveCount(4, { timeout: 20_000 });
    await bottom(page).getByRole("link", { name: "Admin" }).click();
    await expect(page.getByTestId("admin-overview")).toBeVisible({ timeout: 20_000 });
  });

  test("the bar is absent on public and authentication pages", async ({ page }) => {
    for (const r of ["/", "/login", "/signup", "/privacy", "/terms"]) {
      await page.goto(r);
      await expect(page.getByTestId("bottom-nav")).toHaveCount(0);
    }
  });

  test("keyboard: tabs are focusable links with accessible names", async ({ page }) => {
    await login(page);
    await bottom(page).getByRole("link", { name: "Settings" }).focus();
    await expect(bottom(page).getByRole("link", { name: "Settings" })).toBeFocused();
    await expect(page.getByRole("navigation", { name: "Primary" }).locator("visible=true")).toBeVisible();
  });

  for (const [w, h] of VIEWPORTS) {
    test(`no horizontal overflow and a visible bar at ${w}x${h}, portrait and landscape`, async ({ page }) => {
      await login(page);
      for (const [vw, vh] of [[w, h], [h, w]]) {
        await page.setViewportSize({ width: vw, height: vh });
        for (const r of ["/app", "/app/verify", "/app/settings"]) {
          await page.goto(r);
          await expect(page.locator(`main:visible`)).toBeVisible({ timeout: 20_000 });
          const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(over, `${r} at ${vw}x${vh}`).toBeLessThanOrEqual(0);
          if (vw < 768) await expect(bottom(page)).toBeVisible();
          else await expect(page.locator("aside:visible")).toHaveCount(1);
        }
      }
    });
  }
});

test.describe("desktop navigation", () => {
  test.skip(({ isMobile }) => isMobile, "desktop layout");

  test("sidebar is shown, the bottom bar is not, and the active item is marked", async ({ page }) => {
    await login(page);
    await expect(page.locator("aside:visible")).toHaveCount(1);
    await expect(page.getByTestId("bottom-nav")).toBeHidden();
    await expect(page.locator("aside nav a[aria-current=page]")).toHaveText("Dashboard");
    await page.locator("aside nav").getByRole("link", { name: "Settings" }).click();
    await expect(page.locator("aside nav a[aria-current=page]")).toHaveText("Settings");
  });
});

test.describe("service worker and offline behaviour", () => {
  test.skip(({ isMobile }) => isMobile, "run once");

  test("registers, caches only static assets, never API/HTML, shows offline fallback, clears on logout", async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: "allow" });
    const page = await context.newPage();
    const u = await createUserWithToken(uniqueEmail("sw"), PASSWORD);
    await logInViaUI(page, { email: u.email });
    await page.waitForURL("**/app", { timeout: 20_000 });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect(page.locator("main:visible")).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => fetch("/api/inspections").catch(() => null));

    const cached = await page.evaluate(async () => {
      const out: { url: string; type: string }[] = [];
      for (const n of await caches.keys()) for (const r of await (await caches.open(n)).keys()) {
        const res = await (await caches.open(n)).match(r);
        out.push({ url: new URL(r.url).pathname, type: res?.headers.get("content-type") ?? "" });
      }
      return out;
    });
    expect(cached.length).toBeGreaterThan(0);
    expect(cached.some((c) => c.url === "/offline.html")).toBe(true);
    for (const c of cached) {
      expect(c.url.startsWith("/api/")).toBe(false);
      if (c.url !== "/offline.html") expect(c.type).not.toContain("text/html");
    }

    // Offline: banner shows, submission disabled, navigation falls back to the generic offline page.
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByTestId("offline-banner")).toBeVisible();
    await page.goto("/app/verify").catch(() => {});
    await expect(page.getByText("You’re offline").first()).toBeVisible();
    await expect(page.getByText("Nothing is being analysed while you are offline")).toBeVisible();
    await context.setOffline(false);

    // Logout wipes Cache Storage.
    await page.goto("/app/settings");
    await page.evaluate(async () => { await (await caches.open("private-marker")).put("/marker", new Response("x")); });
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await page.waitForURL("**/", { timeout: 20_000 });
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).includes("private-marker")), { timeout: 10_000 }).toBe(false);
    await context.close();
  });

  test("offline banner appears and the hero submit is disabled while offline", async ({ page, context }) => {
    await page.goto("/");
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByTestId("offline-banner")).toBeVisible();
    await expect(page.getByRole("button", { name: "Inspect" })).toBeDisabled();
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByTestId("offline-banner")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Inspect" })).toBeEnabled();
  });

  test("install card gives honest guidance when no browser prompt exists", async ({ page }) => {
    await page.goto("/app/settings").catch(() => {});
    const u = await createUserWithToken(uniqueEmail("inst"), PASSWORD);
    await logInViaUI(page, { email: u.email, path: "/app/settings" });
    await expect(page.getByTestId("install-card")).toContainText(/Install app|Add to Home|Install Internyra/);
  });
});
