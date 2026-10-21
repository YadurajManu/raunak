import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const path = "/style-guide/calm-ui?view=profile";
async function intercept(page: Page) {
  await page.route("**/api/orgs/sample-org/profile", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
}
test("profile draft saves, discards and protects navigation", async ({
  page,
}) => {
  await intercept(page);
  await page.goto(path);
  const tagline = page.getByLabel("Tagline", { exact: true });
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toHaveCount(0);
  await tagline.fill("A new tagline");
  await expect(page.getByText("You have unsaved changes")).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Team", exact: true }).click();
  await expect(page).toHaveURL(/view=profile/);
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(tagline).toHaveValue("Good people, memorable evenings.");
  await tagline.fill("Saved community tagline");
  const request = page.waitForRequest(
    (request) =>
      request.url().endsWith("/profile") && request.method() === "PATCH",
  );
  await page.keyboard.press("Control+s");
  expect((await request).postDataJSON().tagline).toBe(
    "Saved community tagline",
  );
  await expect(
    page.getByRole("status").filter({ hasText: "Profile saved" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toHaveCount(0);
  await tagline.fill("Unsaved again");
  const unload = page.waitForEvent("dialog");
  void page.reload().catch(() => {});
  const warning = await unload;
  expect(warning.type()).toBe("beforeunload");
  await warning.dismiss();
  await expect(tagline).toHaveValue("Unsaved again");
});

test("uploads retry, replace and remove without discarding saved media", async ({
  page,
}) => {
  await intercept(page);
  let attempts = 0;
  await page.route("**/api/orgs/sample-org/cover", async (route) => {
    if (route.request().method() === "POST") {
      attempts++;
      if (attempts === 1) await route.abort();
      else
        await route.fulfill({
          json: { ok: true, coverKey: "/seed/campus-fest.svg" },
        });
    } else await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/orgs/sample-org/logo", (route) =>
    route.fulfill({ json: { ok: true, logoKey: "/seed/campus-fest.svg" } }),
  );
  await page.goto(path);
  const file = {
    name: "cover.png",
    mimeType: "image/png",
    buffer: Buffer.from("sample intercepted upload"),
  };
  const chooser = page.waitForEvent("filechooser");
  await page
    .locator("button")
    .filter({ hasText: /^Upload cover photo$/ })
    .focus();
  await page.keyboard.press("Enter");
  await (await chooser).setFiles(file);
  await expect(page.locator(".pe-page").getByRole("alert")).toContainText(
    "Connection lost",
  );
  await page.getByRole("button", { name: "Retry upload" }).click();
  await expect(page.getByAltText("Current cover photo")).toBeVisible();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Cover photo saved immediately" }),
  ).toBeVisible();
  await page.getByLabel("Tagline", { exact: true }).fill("A draft edit");
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.getByAltText("Current cover photo")).toBeVisible();
  await page
    .getByLabel("Replace cover photo", { exact: true })
    .setInputFiles(file);
  expect(attempts).toBe(3);
  await expect(page.getByAltText("Current cover photo")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove cover", exact: true }).click();
  await expect(page.getByAltText("Current cover photo")).toHaveCount(0);
  await page
    .getByLabel("Profile photo or logo", { exact: true })
    .setInputFiles({
      name: "bad.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("bad"),
    });
  await expect(page.locator(".pe-page").getByRole("alert")).toContainText(
    "Choose a JPG",
  );
  await page
    .getByLabel("Profile photo or logo", { exact: true })
    .setInputFiles(file);
  await expect(page.locator(".pe-logo-row img")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove logo", exact: true }).click();
  await expect(page.locator(".pe-logo-row img")).toHaveCount(0);
});

test("highlight drafts reorder and discard, failed save retains edits", async ({
  page,
}) => {
  await page.route("**/api/orgs/sample-org/profile", (route) =>
    route.fulfill({
      status: 500,
      json: { error: "Could not save profile. Please try again." },
    }),
  );
  await page.goto(path);
  for (const caption of ["First evening", "Second evening"]) {
    await page
      .getByLabel("Image link", { exact: true })
      .fill("https://example.com/highlight.webp");
    await page.getByLabel("Caption (optional)", { exact: true }).fill(caption);
    await page
      .getByRole("button", { name: "Add highlight", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Move highlight 2 up" }).click();
  await expect(page.locator(".pe-highlights li").first()).toContainText(
    "Second evening",
  );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".pe-page").getByRole("alert")).toContainText(
    "Could not save",
  );
  await expect(page.getByText("You have unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.locator(".pe-highlights li")).toHaveCount(0);
});

test("read-only profile and mobile preview are accessible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/style-guide/calm-ui?view=profile-readonly");
  await expect(
    page.getByText("Only workspace owners and administrators can edit it.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Tagline", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include(".pe-preview-dialog").analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true }),
  ).toBeFocused();
});

test("profile layouts in both themes have no overflow or accessibility violations", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 375, 768, 1280, 1440])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(path);
      await page.evaluate(
        (value) => (document.documentElement.dataset.marketingTheme = value),
        theme,
      );
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).include(".pe-page").analyze())
          .violations,
      ).toEqual([]);
      if ([375, 768, 1440].includes(width))
        await page.screenshot({
          path: `/tmp/raunak-calm-15fVY4lO/profile-after-${width}-${theme}.png`,
          fullPage: true,
        });
    }
});
