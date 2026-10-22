import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const fixture = "/style-guide/personal-settings";
const place = {
  city: "Pune",
  region: "Maharashtra",
  countryCode: "IN",
  label: "Pune, Maharashtra, India",
  latitude: 18.52,
  longitude: 73.85,
};
async function intercept(page: Page) {
  await page.route("**/api/profile", (route) => {
    const data = route.request().postDataJSON();
    return route.fulfill({
      json:
        "interestCategories" in data
          ? { interestCategories: data.interestCategories }
          : data,
    });
  });
  await page.route("**/api/location", (route) =>
    route.fulfill({ json: { places: [place] } }),
  );
  await page.route("**/api/profile/security", (route) =>
    route.fulfill({ json: { providers: ["google.com"], emailVerified: true } }),
  );
  await page.route("**/api/profile/privacy", (route) =>
    route.fulfill({
      json:
        route.request().method() === "POST"
          ? { pending: true, requestedAt: "2026-10-22T08:00:00Z" }
          : {
              profile: { name: "Aditi Sharma", email: "aditi@example.test" },
              bookings: [],
            },
    }),
  );
}
test("personal details validate, save normalized phone, discard and guard leaving", async ({
  page,
}) => {
  await intercept(page);
  await page.goto(fixture);
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Phone country", { exact: true }).selectOption("GB");
  await expect(page.getByText("You have unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.getByLabel("Phone country", { exact: true })).toHaveValue(
    "IN",
  );
  await page.getByLabel("Mobile number", { exact: true }).fill("123");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByLabel("Mobile number", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#personal-phone-error")).toContainText(
    "valid phone",
  );
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Aditi Rao");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Back to my plans" }).click();
  await expect(page).toHaveURL(/personal-settings/);
  const request = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/profile") && request.method() === "PATCH",
  );
  await page.keyboard.press("Control+s");
  expect((await request).postDataJSON()).toMatchObject({
    name: "Aditi Rao",
    phone: "+919876543210",
  });
  await expect(
    page.getByText("Your changes are saved.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Full name", { exact: true }).fill("Unsaved name");
  const unload = page.waitForEvent("dialog");
  void page.reload().catch(() => {});
  const prompt = await unload;
  expect(prompt.type()).toBe("beforeunload");
  await prompt.dismiss();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Unsaved name",
  );
});
test("live city suggestions fill region, permission-based location and exact pin remain opt-in", async ({
  page,
  context,
}) => {
  await intercept(page);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 18.52, longitude: 73.85 });
  await page.goto(fixture);
  await page.getByRole("combobox", { name: "City", exact: true }).fill("Pun");
  await expect(
    page.getByRole("listbox", { name: "City suggestions" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "City", exact: true })
    .press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("State / region", { exact: true })).toHaveValue(
    "Maharashtra",
  );
  await page
    .getByRole("button", { name: "Clear location", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "City", exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("button", { name: "Use my location", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "City", exact: true }),
  ).toHaveValue("Pune");
  const exact = page.getByRole("checkbox", {
    name: /Save this precise pin privately/,
  });
  await expect(exact).not.toBeChecked();
  const saved = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/profile") && request.method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  expect((await saved).postDataJSON().location.saveExact).toBe(false);
  await exact.check();
  const precise = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/profile") && request.method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  expect((await precise).postDataJSON().location).toMatchObject({
    latitude: 18.52,
    longitude: 73.85,
    saveExact: true,
  });
});
test("denied location keeps manual entry and failed saves keep edits", async ({
  page,
}) => {
  await intercept(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          _: unknown,
          failure: (error: { code: number }) => void,
        ) => failure({ code: 1 }),
      },
    }),
  );
  await page.route("**/api/profile", (route) =>
    route.fulfill({
      status: 400,
      json: { error: "Could not save profile. Try again." },
    }),
  );
  await page.goto(fixture);
  await page
    .getByRole("button", { name: "Use my location", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Location permission was denied" }),
  ).toBeVisible();
  await page.getByLabel("Full name", { exact: true }).fill("Aditi Rao");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.locator(".personal-settings").getByRole("alert"),
  ).toContainText("Could not save profile");
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Aditi Rao",
  );
  await expect(page.getByText("You have unsaved changes")).toBeVisible();
});
test("reminders and interests persist separately and partial failure retries only unsaved branches", async ({
  page,
}) => {
  await intercept(page);
  const bodies: Record<string, unknown>[] = [];
  let interestAttempts = 0;
  await page.route("**/api/profile", async (route) => {
    const data = route.request().postDataJSON();
    bodies.push(data);
    if (data.interestCategories && interestAttempts++ === 0)
      await route.fulfill({
        status: 500,
        json: { error: "Interests unavailable. Try again." },
      });
    else await route.fulfill({ json: data });
  });
  await page.goto(fixture);
  await page
    .getByRole("button", { name: "Arts & culture", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Explore selected interests" }),
  ).toHaveAttribute("href", /category=arts-culture/);
  await page.getByRole("link", { name: "Notifications", exact: true }).click();
  await page.getByRole("checkbox", { name: /Email reminders/ }).uncheck();
  await page.getByRole("checkbox", { name: /WhatsApp reminders/ }).check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.locator(".personal-settings").getByRole("alert"),
  ).toContainText("Interests unavailable");
  expect(bodies[0]).toEqual({
    emailRemindersEnabled: false,
    whatsappRemindersEnabled: true,
  });
  expect(bodies[1]).toEqual({ interestCategories: ["Arts & culture"] });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Your changes are saved.", { exact: true }),
  ).toBeVisible();
  expect(bodies).toHaveLength(3);
  expect(bodies[2]).toEqual({ interestCategories: ["Arts & culture"] });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Notifications",
  );
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Profile");
});
test("security retry, private data export and reviewed deletion request", async ({
  page,
}) => {
  await intercept(page);
  let retry = false,
    deletions = 0;
  await page.route("**/api/profile/security", (route) =>
    !retry
      ? route.fulfill({
          status: 503,
          json: { error: "Sign-in details temporarily unavailable" },
        })
      : route.fulfill({
          json: { providers: ["google.com"], emailVerified: true },
        }),
  );
  await page.route("**/api/profile/privacy", (route) => {
    if (route.request().method() === "POST") {
      deletions++;
      return route.fulfill({
        json: { pending: true, requestedAt: "2026-10-22T08:00:00Z" },
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        profile: { name: "Aditi Sharma", email: "aditi@example.test" },
        bookings: [],
      }),
    });
  });
  await page.goto(`${fixture}?section=privacy`);
  await expect(
    page.locator(".personal-settings").getByRole("alert"),
  ).toContainText("temporarily unavailable");
  retry = true;
  await page.getByRole("button", { name: "Retry sign-in details" }).click();
  await expect(page.getByText("Google", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Verified by your sign-in provider", { exact: true }),
  ).toBeVisible();
  const ready = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download data", exact: true })
    .click();
  const download = await ready;
  expect(download.suggestedFilename()).toBe("raunak-account-data.json");
  const content = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(content.profile.email).toBe("aditi@example.test");
  expect(JSON.stringify(content)).not.toMatch(/firebase|token|qr/i);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Request account deletion", exact: true })
    .click();
  expect(deletions).toBe(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Request account deletion", exact: true })
    .click();
  await expect(
    page.getByText("Deletion request received.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check deletion request", exact: true }),
  ).toBeEnabled();
  expect(deletions).toBe(1);
});
test("photo crop, upload failure retry, preview and remove keep profile draft", async ({
  page,
}) => {
  await intercept(page);
  let attempts = 0;
  await page.route("**/api/profile/avatar", async (route) => {
    if (route.request().method() === "POST") {
      if (++attempts === 1) await route.abort();
      else await route.fulfill({ json: { url: "/seed/campus-fest.svg" } });
    } else await route.fulfill({ json: { ok: true } });
  });
  await page.goto(fixture);
  const photo = await sharp({
    create: {
      width: 640,
      height: 480,
      channels: 3,
      background: { r: 220, g: 130, b: 90 },
    },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Pending profile change");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload photo", exact: true }).focus();
  await page.keyboard.press("Enter");
  await (
    await chooser
  ).setFiles({ name: "portrait.png", mimeType: "image/png", buffer: photo });
  await expect(
    page.getByRole("dialog", { name: "Adjust profile photo" }),
  ).toBeVisible();
  await page.getByRole("slider", { name: "Zoom", exact: true }).fill("1.5");
  await page
    .getByRole("slider", { name: "Horizontal position", exact: true })
    .fill("0.4");
  await page
    .getByRole("slider", { name: "Vertical position", exact: true })
    .fill("-0.2");
  await page.getByRole("button", { name: "Save photo", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "crop is kept for retry",
  );
  await page.getByRole("button", { name: "Retry upload", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Pending profile change",
  );
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.locator(".avatar-editor-row img")).toHaveAttribute(
    "src",
    "/seed/campus-fest.svg",
  );
  await page.getByRole("button", { name: "Remove photo", exact: true }).click();
  await expect(page.locator(".avatar-editor-row img")).toHaveCount(0);
  await page
    .getByLabel("Profile photo file")
    .setInputFiles({
      name: "bad.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("bad"),
    });
  await expect(page.locator(".avatar-editor").getByRole("alert")).toContainText(
    "Choose a JPEG",
  );
});
test("settings are accessible and responsive in both themes", async ({
  page,
}) => {
  test.setTimeout(120000);
  await intercept(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 375, 768, 1440])
    for (const theme of ["light", "dark"])
      for (const section of ["profile", "notifications", "privacy"]) {
        await page.setViewportSize({ width, height: 960 });
        await page.goto(`${fixture}?section=${section}`);
        await page.evaluate(
          (value) => (document.documentElement.dataset.marketingTheme = value),
          theme,
        );
        if (section === "privacy")
          await expect(page.getByText("Google", { exact: true })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect(
          await page
            .locator(".personal-main")
            .evaluate(
              (element) => element.getBoundingClientRect().right <= innerWidth,
            ),
        ).toBe(true);
        expect(
          (
            await new AxeBuilder({ page })
              .include(".personal-settings")
              .analyze()
          ).violations,
        ).toEqual([]);
        if (width !== 320)
          await page.screenshot({
            path: `/tmp/raunak-personal-UHY9pmxs/after-${section}-${width}-${theme}.png`,
            fullPage: true,
          });
      }
});
