import { test, expect } from "@playwright/test";

test("landing playground, FAQ, pricing and account routes work", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Throw");
  await expect(
    page.getByRole("link", { name: "Host your first event — free" }).first(),
  ).toHaveAttribute("href", "/signup?intent=organizer");
  await page.getByLabel("Your custom note").fill("Bring your dancing shoes.");
  await expect(page.locator(".m-live-note")).toContainText(
    "Bring your dancing shoes.",
  );
  await page.getByRole("switch", { name: "2h reminder" }).click();
  await expect(
    page.getByRole("switch", { name: "2h reminder" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: /Assign Rohan to event/ }).click();
  await expect(page.locator(".m-assign-drop")).toContainText("Rohan assigned");
  await page.getByRole("button", { name: /How do attendees pay/ }).click();
  await expect(
    page.getByRole("button", { name: /How do attendees pay/ }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".m-standard-fee")).toHaveText(
    "2% + ₹3 per paid ticket",
  );
  expect(
    await page.locator('script[type="application/ld+json"]').textContent(),
  ).toContain("FAQPage");
  expect(errors).toEqual([]);
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.locator("#password")).toHaveAttribute("type", "text");
  await page.goto("/signup?intent=organizer");
  await expect(
    page.getByRole("button", { name: "Create your free account" }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /I agree to the Terms/ }),
  ).not.toBeChecked();
});

test("mobile navigation supports keyboard and leaves no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const discover = navigation.getByRole("link", { name: "Discover events" });
  await expect(discover).toBeVisible();
  await discover.focus();
  await page.keyboard.press("Tab");
  await expect(
    navigation.getByRole("link", { name: "My tickets" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open navigation menu" }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Use dark theme" }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("responsive light, dark and reduced motion screenshots", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(90000);
  for (const width of [375, 768, 1440])
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
        colorScheme: theme as "light" | "dark",
      });
      const page = await context.newPage();
      await page.goto(baseURL!);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `artifacts/landing/raunak-${width}-${theme}.png`,
        fullPage: true,
      });
      await context.close();
    }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto(baseURL!);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "artifacts/landing/hero-desktop.png" });
  for (const section of ["features", "pricing", "faq"]) {
    await page.locator(`#${section}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await page
      .locator(`#${section}`)
      .screenshot({ path: `artifacts/landing/${section}-desktop.png` });
  }
  await page.goto(`${baseURL}/login`);
  await page.screenshot({
    path: "artifacts/landing/login-desktop.png",
    fullPage: true,
  });
  await page.goto(`${baseURL}/signup`);
  await page.screenshot({
    path: "artifacts/landing/signup-desktop.png",
    fullPage: true,
  });
  await context.close();
});

test("public links and social image exist; core content survives without JavaScript", async ({
  browser,
  baseURL,
  request,
}) => {
  for (const path of [
    "/privacy",
    "/terms",
    "/contact",
    "/robots.txt",
    "/opengraph-image",
  ])
    expect((await request.get(path)).status()).toBe(200);
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  await page.goto(baseURL!);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Host your first event — free" }).first(),
  ).toHaveAttribute("href", "/signup?intent=organizer");
  await context.close();
});
