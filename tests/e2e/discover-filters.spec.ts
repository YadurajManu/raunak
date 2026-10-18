import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("compact search keeps advanced filters in an accessible cancellable drawer", async ({
  page,
}) => {
  await page.goto("/discover");
  const search = page.getByRole("search", { name: "Find events" });
  expect((await search.boundingBox())!.height).toBeLessThan(90);
  await expect(
    page.getByRole("combobox", { name: "Event format" }),
  ).not.toBeVisible();
  const trigger = page.getByRole("button", { name: "Filters", exact: true });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "Refine your search" });
  await expect(drawer).toBeVisible();
  await drawer
    .getByRole("combobox", { name: "Event format", exact: true })
    .selectOption("ONLINE");
  await drawer
    .getByRole("combobox", { name: "Ticket price", exact: true })
    .selectOption("free");
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(
    page.getByRole("combobox", { name: "City or nearby" }),
  ).toBeVisible();
  await trigger.click();
  await expect(
    drawer.getByRole("combobox", { name: "Event format", exact: true }),
  ).toHaveValue("");
  await expect(
    drawer.getByRole("combobox", { name: "Ticket price", exact: true }),
  ).toHaveValue("");
});

test("online URLs and controls agree and omit all location restrictions", async ({
  page,
}) => {
  await page.goto(
    "/discover?mode=ONLINE&city=Pune&lat=18.52&lng=73.85&radius=5&price=free",
  );
  await expect(
    page.getByRole("heading", { name: "Online events", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Anywhere · Online")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Use my location" }),
  ).not.toBeVisible();
  for (const key of ["city", "lat", "lng", "radius"])
    expect(new URL(page.url()).searchParams.has(key)).toBe(false);
  await expect(
    page.getByRole("link", { name: "Online", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    page.getByRole("link", { name: "Free", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Filters, 2 active" }).click();
  const drawer = page.getByRole("dialog");
  await expect(
    drawer.getByRole("combobox", { name: "Event format", exact: true }),
  ).toHaveValue("ONLINE");
  await expect(
    drawer.getByRole("combobox", { name: "Search radius", exact: true }),
  ).not.toBeVisible();
  await expect(
    drawer.getByLabel("Minimum price", { exact: false }),
  ).toBeDisabled();
});

test("combined search and advanced filters survive refresh and browser navigation", async ({
  page,
}) => {
  await page.goto("/discover");
  await page
    .getByRole("combobox", { name: "Search events, venues or organizers" })
    .fill("night");
  await page.getByRole("combobox", { name: "City or nearby" }).fill("Pune");
  await page.getByRole("option", { name: /^Pune/ }).click();
  await page.getByRole("button", { name: "Find events", exact: true }).click();
  await expect(page).toHaveURL(/city=Pune/);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel("From date", { exact: true }).fill("2027-01-01");
  await drawer.getByLabel("To date", { exact: true }).fill("2027-02-01");
  await drawer
    .getByRole("combobox", { name: "Event format", exact: true })
    .selectOption("HYBRID");
  await drawer
    .getByRole("combobox", { name: "Ticket price", exact: true })
    .selectOption("paid");
  await drawer.getByLabel("Minimum price", { exact: false }).fill("100");
  await drawer.getByLabel("Maximum price", { exact: false }).fill("500");
  await drawer
    .getByRole("combobox", { name: "Sort events", exact: true })
    .selectOption("price");
  await drawer.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/mode=HYBRID/);
  const params = new URL(page.url()).searchParams;
  for (const [key, value] of Object.entries({
    q: "night",
    city: "Pune",
    from: "2027-01-01",
    to: "2027-02-01",
    mode: "HYBRID",
    price: "paid",
    min: "100",
    max: "500",
    sort: "price",
  }))
    expect(params.get(key)).toBe(value);
  await page.reload();
  await page.getByRole("button", { name: "Filters, 4 active" }).click();
  await expect(
    drawer.getByRole("combobox", { name: "Event format", exact: true }),
  ).toHaveValue("HYBRID");
  await expect(
    drawer.getByLabel("Maximum price", { exact: false }),
  ).toHaveValue("500");
  await page.keyboard.press("Escape");
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Filters", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.has("from")).toBe(false);
  await page.goForward();
  await expect(
    page.getByRole("button", { name: "Filters, 4 active" }),
  ).toBeVisible();
});

test("quick filters compose cleanly and custom dates replace quick dates", async ({
  page,
}) => {
  await page.goto("/discover?q=music&city=Pune");
  await page.getByRole("link", { name: "Free", exact: true }).click();
  await expect(page).toHaveURL(/price=free/);
  await page.getByRole("link", { name: "Online", exact: true }).click();
  await expect(page).toHaveURL(/mode=ONLINE/);
  expect(new URL(page.url()).searchParams.has("city")).toBe(false);
  await page.getByRole("link", { name: "In person", exact: true }).click();
  await expect(page).toHaveURL(/mode=IN_PERSON/);
  await expect(
    page.getByRole("combobox", { name: "City or nearby" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page).toHaveURL(/period=today/);
  await page.getByRole("button", { name: /^Filters/ }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel("From date", { exact: true }).fill("2027-01-01");
  await drawer.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/from=2027-01-01/);
  expect(new URL(page.url()).searchParams.has("period")).toBe(false);
  expect(new URL(page.url()).searchParams.get("q")).toBe("music");
  expect(new URL(page.url()).searchParams.get("price")).toBe("free");
});

test("nearby selection exposes radius only while applicable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (success) =>
      success({
        coords: { latitude: 18.52, longitude: 73.85 },
      } as GeolocationPosition);
  });
  await page.goto("/discover");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.locator(".d-location-status")).toContainText(
    "Nearby selected",
  );
  await page.getByRole("button", { name: "Find events", exact: true }).click();
  await expect(page).toHaveURL(/lat=18.52/);
  await page.getByRole("button", { name: /^Filters/ }).click();
  const drawer = page.getByRole("dialog");
  await drawer
    .getByRole("combobox", { name: "Search radius", exact: true })
    .selectOption("10");
  await drawer.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/radius=10/);
  await page.getByRole("link", { name: "Online", exact: true }).click();
  await expect(page.getByText("Anywhere · Online")).toBeVisible();
  expect(new URL(page.url()).searchParams.has("lat")).toBe(false);
});

test("mobile drawer and search remain usable in both themes", async ({
  browser,
  baseURL,
}) => {
  for (const width of [320, 390])
    for (const colorScheme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        colorScheme,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.goto(`${baseURL}/discover`);
      await expect(
        page.getByRole("button", { name: "Find events", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `artifacts/discover/compact-${width}-${colorScheme}.png`,
      });
      await page.getByRole("button", { name: /^Filters/ }).click();
      const drawer = page.getByRole("dialog");
      await expect(drawer).toBeVisible();
      expect((await drawer.boundingBox())!.width).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: `artifacts/discover/drawer-${width}-${colorScheme}.png`,
      });
      await drawer.getByRole("button", { name: "Close filters" }).click();
      await expect(
        page.getByRole("button", { name: /^Filters/ }),
      ).toBeFocused();
      await context.close();
    }
});
