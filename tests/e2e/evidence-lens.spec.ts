import { expect, test, type Page } from "@playwright/test";

const LENS = '[aria-label^="Interactive 3D Evidence Instrument"]';
const FALLBACK = '[aria-label="Internyra Evidence Instrument illustration"]';

/** Counts WebGL draw calls so tests can tell whether the scene is actually rendering. */
async function countDraws(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __draws: number };
    w.__draws = 0;
    for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const fn of ["drawElements", "drawArrays"] as const) {
        const original = proto[fn] as (...a: unknown[]) => void;
        (proto as unknown as Record<string, unknown>)[fn] = function (this: unknown, ...args: unknown[]) {
          w.__draws += 1;
          return original.apply(this, args);
        };
      }
    }
  });
}

/** The instrument lives in the three-step section (wide screens only); bring it into view. */
async function openLens(page: Page) {
  await page.goto("/");
  await page.locator("#steps").scrollIntoViewIfNeeded();
  await page.evaluate(() => document.getElementById("steps")!.scrollIntoView());
}

const draws = (page: Page) => page.evaluate(() => (window as unknown as { __draws: number }).__draws);

async function drawsDuring(page: Page, ms: number) {
  const before = await draws(page);
  await page.waitForTimeout(ms);
  return (await draws(page)) - before;
}

test.describe("Evidence Lens", () => {
  // Each test creates a WebGL context; running them in parallel with the rest of the suite starves
  // the GPU and delays initialisation, so this file runs serially with a longer canvas timeout.
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, "the 3D scene is only mounted on wide screens; phones get the plain step list");
  });

  test("renders a WebGL scene without errors while the hero stays usable", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await countDraws(page);
    await openLens(page);

    // The heading and URL input work before/while the scene initialises.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByLabel("Internship link to check").fill("https://careers.example.com/x");

    const lens = page.locator(LENS);
    await expect(lens.locator("canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(FALLBACK)).toHaveCount(0);
    await lens.scrollIntoViewIfNeeded();
    expect(await drawsDuring(page, 500)).toBeGreaterThan(10);

    // The canvas fits inside its panel.
    const panel = (await lens.boundingBox())!;
    const canvas = (await lens.locator("canvas").boundingBox())!;
    expect(canvas.width).toBeLessThanOrEqual(panel.width + 1);
    expect(canvas.height).toBeLessThanOrEqual(panel.height + 1);

    expect(errors).toEqual([]);
  });

  test("drag shows the interacting state and settles back on release", async ({ page, isMobile }) => {
    test.skip(isMobile, "mouse drag is desktop; touch is covered separately");
    await openLens(page);
    const lens = page.locator(LENS);
    await expect(lens.locator("canvas")).toBeVisible({ timeout: 15_000 });
    const box = (await lens.locator("canvas").boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const before = await lens.locator("canvas").screenshot();
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 120, cy + 40, { steps: 8 });
    await expect(lens).toHaveAttribute("data-state", "interacting");
    await page.waitForTimeout(400);
    const dragged = await lens.locator("canvas").screenshot();
    expect(dragged.equals(before)).toBe(false);
    await page.mouse.up();
    await expect(lens).toHaveAttribute("data-state", "idle");

    // Dragging the lens must not block the page's own controls.
    await page.getByLabel("Internship link to check").click();
    await expect(page.getByLabel("Internship link to check")).toBeFocused();
  });

  test("stops drawing when scrolled offscreen and resumes when visible", async ({ page }) => {
    await countDraws(page);
    await openLens(page);
    const lens = page.locator(LENS);
    await expect(lens.locator("canvas")).toBeVisible({ timeout: 15_000 });
    await lens.scrollIntoViewIfNeeded();
    expect(await drawsDuring(page, 500)).toBeGreaterThan(10);

    await page.locator("#faq").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    expect(await drawsDuring(page, 600)).toBe(0);

    await lens.scrollIntoViewIfNeeded();
    expect(await drawsDuring(page, 500)).toBeGreaterThan(10);
  });

  test("scrolling the page is not captured by the scene", async ({ page }) => {
    await openLens(page);
    await expect(page.locator(LENS).locator("canvas")).toBeVisible({ timeout: 15_000 });
    await page.mouse.wheel(0, 400);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  });

  test("reduced motion shows the static schematic instead of the animated scene", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", serviceWorkers: "block" });
    const page = await context.newPage();
    await openLens(page);
    await expect(page.locator(FALLBACK)).toBeVisible();
    await expect(page.locator(LENS)).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(0);
    await context.close();
  });

  test("without WebGL the schematic fallback is shown and nothing throws", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type.includes("webgl")) return null;
        return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof original;
    });
    await openLens(page);
    await expect(page.locator(FALLBACK)).toBeVisible();
    await expect(page.getByLabel("Internship link to check")).toBeAttached();
    expect(errors).toEqual([]);
  });
});
