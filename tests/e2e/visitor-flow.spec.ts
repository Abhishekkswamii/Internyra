import { expect, test } from "@playwright/test";
import { adminAuth, adminDb, createUserWithToken, findInspections, logInViaUI, signUpViaUI, submitFromHero, uniqueEmail } from "./helpers";

const SECTIONS = ["Company", "Internship", "Recruiter", "Risk indicators", "Evidence"];
const uniqueUrl = () => `https://careers.${Date.now()}${Math.floor(Math.random() * 1e6)}.example/intern`;

test.describe("visitor submission, sign-up and claim (against emulators)", () => {
  test.skip(({ isMobile }) => isMobile, "full auth flows run once on desktop; layout is covered on mobile separately");

  test("a visitor gets a real pending inspection and a locked shell with only section headings", async ({ page }) => {
    const url = uniqueUrl();
    await submitFromHero(page, url);

    const shell = page.getByTestId("locked-shell");
    for (const name of SECTIONS) await expect(shell.getByText(name, { exact: true }).first()).toBeVisible();
    // No findings, names, scores or verdicts are shown before sign-in.
    const text = (await shell.innerText()).toLowerCase();
    expect(text).not.toMatch(/risk score|verdict|suspicious indicators|no major red flags|needs caution|\d+\s*%|source:/);

    const saved = (await findInspections("pending_auth")).find((r) => (r as unknown as { submission: { url: string } }).submission.url === url);
    expect(saved, "a pending_auth record exists in Firestore").toBeTruthy();
    expect(saved?.research).toBeUndefined();
    const owner = await adminAuth().getUser(saved!.ownerUid);
    expect(owner.providerData).toHaveLength(0); // anonymous identity
  });

  test("the saved request survives a refresh", async ({ page }) => {
    await submitFromHero(page, uniqueUrl());
    await page.reload();
    await expect(page.getByTestId("locked-shell")).toBeVisible({ timeout: 20_000 });
  });

  test("sign-up upgrades the SAME identity, so the pending request stays with that owner and becomes queued", async ({ page }) => {
    const url = uniqueUrl();
    await submitFromHero(page, url);
    const before = (await findInspections("pending_auth")).find((r) => (r as unknown as { submission: { url: string } }).submission.url === url)!;

    const email = uniqueEmail("signup");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill("pass-1234");
    await page.getByRole("button", { name: "Create account and continue" }).click();

    await page.waitForURL(/\/app\/reports\/insp_/, { timeout: 30_000 });
    // Honest state: AI is switched off in this environment, so the inspection stays queued. Nothing is faked.
    await expect(page.getByTestId("inspection-status")).toHaveAttribute("data-status", "queued");
    await expect(page.getByText("Saved and queued")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start inspection" })).toBeDisabled();

    const after = (await findInspections()).find((r) => r.id === before.id)!;
    expect(after.status).toBe("queued");
    expect(after.ownerUid).toBe(before.ownerUid); // same UID: linked, not copied
    expect((await adminAuth().getUser(after.ownerUid)).email).toBe(email);
  });

  test("signing in to an EXISTING account claims the pending request only with proof of the anonymous identity", async ({ page }) => {
    const existing = await createUserWithToken(uniqueEmail("existing"), "pass-1234");
    const url = uniqueUrl();
    await submitFromHero(page, url);
    const before = (await findInspections("pending_auth")).find((r) => (r as unknown as { submission: { url: string } }).submission.url === url)!;
    const anonUid = before.ownerUid;

    await page.getByRole("button", { name: "Already have an account? Sign in" }).click();
    await page.getByLabel("Email address").fill(existing.email);
    await page.getByLabel("Password").fill("pass-1234");
    await page.getByRole("button", { name: "Sign in and continue" }).click();
    await page.waitForURL(/\/app\/reports\/insp_/, { timeout: 30_000 });

    const after = (await findInspections()).find((r) => r.id === before.id)!;
    expect(after.ownerUid).toBe(existing.uid);
    expect(after.status).toBe("queued");
    await expect(adminAuth().getUser(anonUid)).rejects.toBeTruthy(); // temporary identity cleaned up
  });

  test("wrong credentials show a safe message and claim nothing", async ({ page }) => {
    const existing = await createUserWithToken(uniqueEmail("wrongpw"), "pass-1234");
    const url = uniqueUrl();
    await submitFromHero(page, url);
    await page.getByRole("button", { name: "Already have an account? Sign in" }).click();
    await page.getByLabel("Email address").fill(existing.email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in and continue" }).click();
    await expect(page.getByTestId("locked-shell").getByRole("alert")).toContainText("incorrect");
    const rec = (await findInspections()).find((r) => (r as unknown as { submission: { url: string } }).submission.url === url)!;
    expect(rec.status).toBe("pending_auth");
  });
});

test.describe("student workspace", () => {
  test.skip(({ isMobile }) => isMobile, "desktop flow");

  test("a signed-in student sees an honest empty dashboard, can add and delete an inspection, and persists across logout/login", async ({ page }) => {
    const email = uniqueEmail("student");
    await page.goto("/app");
    await page.waitForURL(/\/login\?next=/);
    await signUpViaUI(page, { email });
    await expect(page.getByTestId("empty-state")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("No inspections yet")).toBeVisible();
    await expect(page.getByTestId("tile-inspections")).toHaveText("0");

    // New inspection (queued, because AI is off here)
    await page.goto("/app/verify");
    await page.getByLabel("Internship or job link").fill(uniqueUrl());
    await page.getByRole("button", { name: "Run inspection" }).click();
    await page.waitForURL(/\/app\/reports\/insp_/);
    await expect(page.getByText("Saved and queued")).toBeVisible();

    await page.goto("/app");
    await expect(page.getByTestId("inspection-row")).toHaveCount(1);
    await expect(page.getByTestId("tile-inspections")).toHaveText("1");

    // Logout / login: history is server-side, so it comes back.
    await page.goto("/app/settings");
    await page.getByRole("region", { name: "Account", exact: true }).getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/");
    await page.goto("/app");
    await page.waitForURL(/\/login\?next=/);
    await logInViaUI(page, { email, path: page.url() });
    await expect(page.getByTestId("inspection-row")).toHaveCount(1, { timeout: 20_000 });

    // Delete the inspection from its page.
    await page.getByTestId("inspection-row").click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await page.waitForURL("/app");
    await expect(page.getByText("No inspections yet")).toBeVisible();
  });

  test("account deletion removes the sign-in account and every stored record", async ({ page }) => {
    const email = uniqueEmail("leaving");
    await signUpViaUI(page, { email });
    await expect(page.getByTestId("empty-state")).toBeVisible({ timeout: 20_000 });
    await page.goto("/app/verify");
    await page.getByLabel("Internship or job link").fill(uniqueUrl());
    await page.getByRole("button", { name: "Run inspection" }).click();
    await page.waitForURL(/\/app\/reports\/insp_/);
    const user = await adminAuth().getUserByEmail(email);

    await page.goto("/app/settings");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.getByRole("button", { name: "Yes, delete everything" }).click();
    await page.waitForURL("/", { timeout: 20_000 });

    await expect(adminAuth().getUser(user.uid)).rejects.toBeTruthy();
    expect((await adminDb().collection("users").doc(user.uid).collection("inspections").get()).size).toBe(0);
    expect((await adminDb().collection("users").doc(user.uid).get()).exists).toBe(false);
  });
});
