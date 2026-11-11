import { expect, test } from "@playwright/test";
import { adminAuth, createUserWithToken, findInspections, logInViaUI, oobCodes, PASSWORD, signUpViaUI, submitFromHero, uniqueEmail } from "./helpers";

const uniqueUrl = () => `https://careers.${Date.now()}${Math.floor(Math.random() * 1e6)}.example/intern`;

test.describe("navigation by authentication state", () => {
  test("signed-out desktop navbar: Log in + Sign up only, no Core/Dashboard launchers", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop navbar");
    await page.goto("/");
    const actions = page.getByTestId("nav-actions");
    await expect(actions).toHaveAttribute("data-auth", "out");
    await expect(actions.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    await expect(actions.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup");
    for (const gone of ["Access Core", "Launch Dashboard", "Open Core Dashboard"]) await expect(page.getByText(gone)).toHaveCount(0);
    for (const l of ["What it examines", "Forensic workflow", "How it works", "Questions"]) await expect(page.getByRole("navigation", { name: "Sections" }).getByText(l)).toBeVisible();
  });

  test("signed-out mobile menu offers Sign up and Log in", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile navbar");
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const m = page.getByTestId("mobile-nav-actions");
    await expect(m.getByRole("link", { name: "Sign up" })).toBeVisible();
    await expect(m.getByRole("link", { name: "Log in" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("a signed-in student sees Dashboard + account menu (no Admin), and can log out", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop navbar");
    const u = await createUserWithToken(uniqueEmail("navstudent"), PASSWORD);
    await logInViaUI(page, { email: u.email });
    await page.waitForURL("**/app");
    await page.goto("/");
    const actions = page.getByTestId("nav-actions");
    await expect(actions).toHaveAttribute("data-auth", "in", { timeout: 15_000 });
    await expect(actions.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(actions.getByRole("link", { name: "Log in" })).toHaveCount(0);
    await expect(actions.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
    await actions.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByRole("menuitem", { name: "Admin dashboard" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page.getByTestId("nav-actions")).toHaveAttribute("data-auth", "out", { timeout: 15_000 });
    await expect(page.getByRole("link", { name: "Sign up" }).first()).toBeVisible();
  });

  test("the administrator sees the Admin dashboard entry; verified from the Firebase claim", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop navbar");
    await logInViaUI(page, { email: "admin@e2e.test", password: "e2e-admin-pass-1" });
    await page.waitForURL("**/app");
    await page.goto("/");
    const actions = page.getByTestId("nav-actions");
    await expect(actions).toHaveAttribute("data-auth", "in", { timeout: 15_000 });
    await expect(actions.getByRole("link", { name: "Admin", exact: true })).toBeVisible();
    await actions.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByRole("menuitem", { name: "Admin dashboard" })).toBeVisible();
  });

  test("signed-in mobile menu shows Dashboard, Settings and Log out", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile navbar");
    const u = await createUserWithToken(uniqueEmail("mobilein"), PASSWORD);
    await logInViaUI(page, { email: u.email });
    await page.waitForURL("**/app");
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const m = page.getByTestId("mobile-nav-actions");
    await expect(m).toHaveAttribute("data-auth", "in", { timeout: 15_000 });
    await expect(m.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(m.getByRole("link", { name: "Account settings" })).toBeVisible();
    await expect(m.getByRole("button", { name: "Log out" })).toBeVisible();
  });
});

test.describe("authentication pages", () => {
  for (const [path, mode] of [["/auth?mode=signup", "signup"], ["/auth?mode=login", "login"], ["/signup", "signup"], ["/login", "login"]] as const) {
    test(`${path} renders the ${mode} form with Google and email options`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome to Internyra");
      await expect(page.getByText("Your internship verification workspace starts here.")).toBeVisible();
      const tabs = page.getByRole("group", { name: "Account" });
      await expect(tabs.getByRole("button", { name: mode === "signup" ? "Create account" : "Log in" })).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
      await expect(page.getByText("or continue with email")).toBeVisible();
      await expect(page.getByLabel("Email address")).toBeVisible();
      await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
      if (mode === "signup") {
        await expect(page.getByLabel("Full name")).toBeVisible();
        await expect(page.getByLabel("Confirm password")).toBeVisible();
      } else {
        await expect(page.getByLabel("Full name")).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Forgot password?" })).toBeVisible();
      }
      await expect(page.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
      await expect(page.getByRole("link", { name: "Privacy Notice" })).toHaveAttribute("href", "/privacy");
      // A bare authentication page: none of the Core application chrome.
      await expect(page.getByRole("complementary")).toHaveCount(0);
      await expect(page.getByPlaceholder("Search inspections...")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    });
  }

  test("the mode selector switches between create account and log in", async ({ page }) => {
    await page.goto("/signup");
    const tabs = page.getByRole("group", { name: "Account" });
    await tabs.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Full name")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Forgot password?" })).toBeVisible();
    await tabs.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByLabel("Confirm password")).toBeVisible();
    await page.reload(); // the URL alone restores the same form
    await expect(page.getByLabel("Confirm password")).toBeVisible();
  });

  test("brand panel is shown on desktop only, and the form comes first on phones", async ({ page, isMobile }) => {
    await page.goto("/signup");
    await expect(page.getByText("signing up for.")).toBeVisible({ visible: !isMobile });
    if (isMobile) {
      const box = await page.getByLabel("Email address").boundingBox();
      expect(box!.y).toBeLessThan(760);
    }
  });

  test("client-side validation: email, weak password, mismatch, show/hide password", async ({ page }) => {
    await page.goto("/signup");
    const submit = page.getByTestId("auth-submit");
    await page.getByLabel("Full name").fill("Ada Student");
    await page.getByLabel("Email address").fill("not-an-email");
    await submit.click();
    await expect(page.getByTestId("auth-error")).toContainText("valid email");
    await page.getByLabel("Email address").fill(uniqueEmail("val"));
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByLabel("Confirm password").fill("short");
    await submit.click();
    await expect(page.getByTestId("auth-error")).toContainText("stronger password");
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill("Different-1");
    await submit.click();
    await expect(page.getByTestId("auth-error")).toContainText("don't match");
    const pw = page.getByLabel("Password", { exact: true });
    await expect(pw).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(pw).toHaveAttribute("type", "text");
  });
});

test.describe("email/password flows", () => {
  test.skip(({ isMobile }) => isMobile, "flows run once on desktop");

  test("sign-up creates the account, sends a verification email, lands on the dashboard and shows the name", async ({ page }) => {
    const email = uniqueEmail("signupui");
    await signUpViaUI(page, { name: "Ada Lovelace", email });
    await page.waitForURL("**/app", { timeout: 30_000 });
    await expect(page.getByTestId("empty-state")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("verify-banner")).toBeVisible();
    const user = await adminAuth().getUserByEmail(email);
    expect(user.displayName).toBe("Ada Lovelace");
    expect(user.emailVerified).toBe(false);
    expect((await oobCodes()).some((c) => c.email === email && c.requestType === "VERIFY_EMAIL")).toBe(true);
  });

  test("duplicate sign-up gives a neutral message that does not confirm the address is registered", async ({ page }) => {
    const existing = await createUserWithToken(uniqueEmail("dupe"), PASSWORD);
    await signUpViaUI(page, { email: existing.email });
    const alert = page.getByTestId("auth-error").filter({ hasText: "couldn't create an account" });
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(alert).not.toContainText(/already (exists|in use|registered with)/i);
  });

  test("log in with the right password works; wrong password and unknown email give the same generic error", async ({ page }) => {
    const u = await createUserWithToken(uniqueEmail("login"), PASSWORD);
    await logInViaUI(page, { email: u.email, password: "Wrong-pass-1" });
    const wrong = await page.getByTestId("auth-error").innerText();
    expect(wrong).toContain("incorrect");
    await logInViaUI(page, { email: uniqueEmail("ghost"), password: "Wrong-pass-1" });
    expect(await page.getByTestId("auth-error").innerText()).toBe(wrong);
    await logInViaUI(page, { email: u.email });
    await page.waitForURL("**/app", { timeout: 20_000 });
  });

  test("password reset: neutral confirmation for any address, a real reset code for real accounts, and the new password works", async ({ page }) => {
    const u = await createUserWithToken(uniqueEmail("reset"), PASSWORD);
    const ask = async (email: string) => {
      await page.goto("/login");
      await page.getByRole("button", { name: "Forgot password?" }).click();
      await page.getByLabel("Email address").fill(email);
      await page.getByRole("button", { name: "Send reset link" }).click();
      return page.getByTestId("reset-sent");
    };
    const known = await ask(u.email);
    await expect(known).toContainText("If an account exists for that address");
    const knownText = await known.innerText();
    const unknown = await ask(uniqueEmail("nobody"));
    await expect(unknown).toBeVisible();
    expect(await unknown.innerText()).toBe(knownText); // indistinguishable
    const code = (await oobCodes()).filter((c) => c.email === u.email && c.requestType === "PASSWORD_RESET").pop();
    expect(code, "a reset code was issued for the real account").toBeTruthy();

    const newPw = "Brand-new-pw-9";
    const done = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ oobCode: code!.oobCode, newPassword: newPw }) });
    expect(done.ok).toBe(true);
    await logInViaUI(page, { email: u.email, password: newPw });
    await page.waitForURL("**/app", { timeout: 20_000 });
  });

  test("logging out from the dashboard ends the session", async ({ page }) => {
    const u = await createUserWithToken(uniqueEmail("logout"), PASSWORD);
    await logInViaUI(page, { email: u.email });
    await page.waitForURL("**/app");
    await page.goto("/app/settings");
    await page.getByRole("region", { name: "Account", exact: true }).getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/");
    await page.goto("/app");
    await page.waitForURL(/\/login\?next=/);
  });
});

test.describe("protected application and redirects", () => {
  test.skip(({ isMobile }) => isMobile, "flows run once on desktop");

  test("opening /app signed out redirects to /login?next=/app with no Core shell", async ({ page }) => {
    await page.goto("/app");
    await page.waitForURL(/\/login\?next=%2Fapp$/);
    await expect(page.getByRole("complementary")).toHaveCount(0);
    await expect(page.getByText("New inspection")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome to Internyra");
  });

  test("a deep link is remembered and used after login", async ({ page }) => {
    const u = await createUserWithToken(uniqueEmail("deep"), PASSWORD);
    await page.goto("/app/settings");
    await page.waitForURL(/\/login\?next=%2Fapp%2Fsettings/);
    await logInViaUI(page, { email: u.email, path: page.url() });
    await page.waitForURL("**/app/settings", { timeout: 20_000 });
    await expect(page.getByTestId("account-email")).toHaveText(u.email);
  });

  test("hostile next= values never leave the site", async ({ page }) => {
    const u = await createUserWithToken(uniqueEmail("hostile"), PASSWORD);
    for (const bad of ["https://evil.example/phish", "//evil.example", "/%2F%2Fevil.example", "javascript:alert(1)"]) {
      await logInViaUI(page, { email: u.email, path: `/login?next=${encodeURIComponent(bad)}` });
      await page.waitForURL("**/app", { timeout: 20_000 });
      expect(new URL(page.url()).hostname).toBe("localhost");
      expect(page.url()).not.toContain("evil");
      await page.goto("/app/settings");
      await page.getByRole("region", { name: "Account", exact: true }).getByRole("button", { name: "Sign out" }).click();
      await page.waitForURL("/");
    }
  });

  test("an already signed-in user visiting /login is sent on to the app", async ({ page }) => {
    const u = await createUserWithToken(uniqueEmail("already"), PASSWORD);
    await logInViaUI(page, { email: u.email });
    await page.waitForURL("**/app");
    await page.goto("/login");
    await page.waitForURL("**/app", { timeout: 15_000 });
  });
});

test.describe("pending inspection handoff through the new pages", () => {
  test.skip(({ isMobile }) => isMobile, "flows run once on desktop");

  test("Sign up from the navbar after submitting keeps the SAME identity and the request reaches the dashboard", async ({ page }) => {
    const url = uniqueUrl();
    await submitFromHero(page, url);
    const before = (await findInspections("pending_auth")).find((r) => (r as unknown as { submission: { url: string } }).submission.url === url)!;
    await page.getByTestId("nav-actions").getByRole("link", { name: "Sign up" }).click();
    await page.waitForURL("**/signup");
    const email = uniqueEmail("handoff");
    await signUpViaUI(page, { email, path: page.url() });
    await page.waitForURL("**/app", { timeout: 30_000 });
    await expect(page.getByTestId("inspection-row")).toHaveCount(1, { timeout: 20_000 });
    // The dashboard must already reflect the claim: no stale "Waiting for sign-in" chip.
    await expect(page.getByTestId("inspection-row")).toContainText("Queued");
    await expect(page.getByTestId("inspection-row")).not.toContainText("Waiting for sign-in");
    const after = (await findInspections()).find((r) => r.id === before.id)!;
    expect(after.ownerUid).toBe(before.ownerUid);
    expect(after.status).toBe("queued");
    expect((await adminAuth().getUser(after.ownerUid)).email).toBe(email);
  });

  test("Log in to an existing account after submitting claims it only via the anonymous identity", async ({ page }) => {
    const existing = await createUserWithToken(uniqueEmail("existing2"), PASSWORD);
    const url = uniqueUrl();
    await submitFromHero(page, url);
    const before = (await findInspections("pending_auth")).find((r) => (r as unknown as { submission: { url: string } }).submission.url === url)!;
    await logInViaUI(page, { email: existing.email, path: "/login" });
    await page.waitForURL("**/app", { timeout: 30_000 });
    await expect(page.getByTestId("inspection-row")).toHaveCount(1, { timeout: 20_000 });
    await expect(page.getByTestId("inspection-row")).toContainText("Queued");
    const after = (await findInspections()).find((r) => r.id === before.id)!;
    expect(after.ownerUid).toBe(existing.uid);
    expect(after.status).toBe("queued");
    await expect(adminAuth().getUser(before.ownerUid)).rejects.toBeTruthy();
  });

  test("a different account never receives someone else's pending request", async ({ page, browser }) => {
    const url = uniqueUrl();
    await submitFromHero(page, url);
    const before = (await findInspections("pending_auth")).find((r) => (r as unknown as { submission: { url: string } }).submission.url === url)!;
    // A second person, on another browser, signs in to their own account.
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    const attacker = await createUserWithToken(uniqueEmail("attacker2"), PASSWORD);
    await logInViaUI(other, { email: attacker.email });
    await other.waitForURL("**/app", { timeout: 20_000 });
    await expect(other.getByTestId("empty-state")).toBeVisible({ timeout: 20_000 });
    const rec = (await findInspections()).find((r) => r.id === before.id)!;
    expect(rec.ownerUid).toBe(before.ownerUid);
    expect(rec.status).toBe("pending_auth");
    await ctx.close();
  });
});

test.describe("Google sign-in (Auth emulator popup)", () => {
  test.skip(({ isMobile }) => isMobile, "popup flow runs once on desktop");

  test("Continue with Google signs in through the provider popup", async ({ page, context }) => {
    await page.goto("/login");
    const popupPromise = context.waitForEvent("page");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    await popup.getByText("Add new account").click();
    await popup.getByRole("button", { name: /Auto-generate user information/i }).click();
    await popup.getByRole("button", { name: /Sign in with Google\.com/i }).click();
    await page.waitForURL("**/app", { timeout: 30_000 });
    await expect(page.getByTestId("empty-state")).toBeVisible({ timeout: 20_000 });
  });
});
