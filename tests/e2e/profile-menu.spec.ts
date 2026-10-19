import { expect, test } from "@playwright/test";

const storageState = process.env.PLAYWRIGHT_AUTH_STATE;

test.describe("signed-in account menu", () => {
  test.skip(!storageState, "Set PLAYWRIGHT_AUTH_STATE to an isolated signed-in session.");
  test.use({ storageState: storageState || { cookies: [], origins: [] } });

  test("captures both themes and responsive menu sizes", async ({ page }) => {
    await page.goto("/account");
    const trigger = page.getByRole("button", { name: /^Open account menu for/ });
    await expect(trigger).toBeVisible();
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate((value) => {
          document.documentElement.dataset.marketingTheme = value;
        }, theme);
        await page.screenshot({
          path: `artifacts/profile-menu/before-${width}-${theme}.png`,
        });
        await trigger.click();
        await expect(page.getByRole("menu", { name: "Account menu" })).toBeVisible();
        await page.screenshot({
          path: `artifacts/profile-menu/after-${width}-${theme}.png`,
        });
        await page.keyboard.press("Escape");
        await expect(trigger).toHaveAttribute("aria-expanded", "false");
      }
    }
  });

  test("supports outside close, menu keyboard controls, and sign out", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const preferences = {
      emailRemindersEnabled: true,
      whatsappRemindersEnabled: false,
    };
    await page.route("**/api/profile", async (route) => {
      Object.assign(preferences, route.request().postDataJSON());
      await route.fulfill({ json: preferences });
    });
    await page.goto("/account");
    const trigger = page.getByRole("button", { name: /^Open account menu for/ });
    await trigger.click();
    const menu = page.getByRole("menu", { name: "Account menu" });
    const editProfile = page.getByRole("menuitem", { name: "Edit profile" });
    await expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(editProfile).toBeFocused();
    await page.keyboard.press("ArrowDown");
    const emailToggle = page.getByRole("menuitemcheckbox", {
      name: "Email event reminders",
    });
    await expect(emailToggle).toBeFocused();
    await page.keyboard.press("Space");
    await expect(emailToggle).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("h");
    await expect(page.getByRole("menuitem", { name: "Help & contact" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(editProfile).toBeFocused();
    await page.locator("h1").first().click({ force: true });
    await expect(menu).toBeHidden();

    await trigger.click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("status")).toHaveText("Signed out");
  });
});
