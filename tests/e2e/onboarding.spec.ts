import { test, expect } from "@playwright/test";
test("personal onboarding selects a real map pin, confirms location and saves profile", async ({
  page,
  request,
}) => {
  const preview = await request.get("/style-guide/onboarding");
  test.skip(
    preview.status() === 404,
    "Development-only component preview is disabled in production.",
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/api/location", async (route) => {
    const input = route.request().postDataJSON();
    await route.fulfill({
      json: {
        places: [
          {
            city: "Pune",
            region: "Maharashtra",
            countryCode: "IN",
            label: "Pune, Maharashtra, India",
            latitude: input.latitude ?? 18.5204,
            longitude: input.longitude ?? 73.8567,
          },
        ],
      },
    });
  });
  let saved: Record<string, unknown> | undefined;
  await page.route("**/api/profile", async (route) => {
    saved = route.request().postDataJSON();
    await route.fulfill({
      json: { id: "test", onboardingCompletedAt: new Date().toISOString() },
    });
  });
  await page.goto("/style-guide/onboarding");
  await page.getByLabel("What should we call you?").fill("Aditi Sharma");
  await page.getByLabel("Mobile number").fill("9876543210");
  await page.getByLabel("Female", { exact: true }).check();
  await page.getByRole("button", { name: "Continue →" }).click();
  await page.getByLabel("Search for a city or place").fill("Pune");
  await page.getByRole("button", { name: "Search ↗" }).click();
  await page.locator(".r-place-results button").first().click();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await page
    .locator(".maplibregl-canvas")
    .click({ position: { x: 230, y: 150 } });
  await expect(page.locator(".r-selected-place")).toBeVisible();
  await page.getByRole("button", { name: "Confirm location" }).click();
  await page.screenshot({
    path: "artifacts/landing/onboarding-location-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.locator(".r-profile-review")).toContainText("Not stored");
  await page.getByRole("button", { name: "Let’s go ↗" }).click();
  await expect.poll(() => saved?.name).toBe("Aditi Sharma");
  expect(saved?.location).toMatchObject({ city: "Pune", saveExact: false });
  expect(errors).toEqual([]);
});
test("onboarding supports skipping optional fields on mobile", async ({
  page,
  request,
}) => {
  test.skip(
    (await request.get("/style-guide/onboarding")).status() === 404,
    "Development-only preview.",
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/style-guide/onboarding");
  await page.getByLabel("What should we call you?").fill("Rohan");
  await page.getByLabel("Mobile number").fill("9876543210");
  await page.getByRole("button", { name: "Continue →" }).click();
  await page.getByRole("button", { name: "Skip location for now →" }).click();
  await expect(page.locator(".r-profile-review")).toContainText("Not shared");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/landing/onboarding-review-mobile.png",
    fullPage: true,
  });
});

test("profile and geocoding endpoints reject unsigned requests", async ({
  request,
  baseURL,
}) => {
  const headers = { origin: baseURL! };
  expect(
    (
      await request.patch("/api/profile", {
        headers,
        data: { name: "No session", phone: "9876543210" },
      })
    ).status(),
  ).toBeGreaterThanOrEqual(400);
  expect(
    (
      await request.post("/api/location", {
        headers,
        data: { kind: "search", query: "Pune" },
      })
    ).status(),
  ).toBeGreaterThanOrEqual(400);
});
