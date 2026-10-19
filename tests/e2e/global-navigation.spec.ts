import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("visitor navigation stays aligned at mobile, tablet and desktop sizes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((value) => {
        localStorage.setItem("raunak-theme", value);
        document.documentElement.dataset.marketingTheme = value;
        window.dispatchEvent(new Event("raunak-theme"));
      }, theme);
      await page.screenshot({ path: `artifacts/global-navigation/nav-${width}-${theme}.png` });
      const audit = new AxeBuilder({ page }).include(".gnav").include(".gnav-mobile-tabs");
      const result = await audit.analyze();
      expect(result.violations).toEqual([]);
    }
    await page.evaluate(() => {
      localStorage.setItem("raunak-theme", "light");
      document.documentElement.dataset.marketingTheme = "light";
      window.dispatchEvent(new Event("raunak-theme"));
    });
    const primary = page.getByRole("navigation", { name: "Primary" });
    if (width >= 768) {
      await expect(primary.getByRole("link", { name: "Discover" })).toBeVisible();
    } else {
      await expect(page.locator(".gnav-links")).toBeHidden();
    }
    await expect(page.getByRole("banner").getByRole("link", { name: "Log in" })).toBeVisible();
    if (width < 768) {
      await expect(page.getByRole("navigation", { name: "Quick navigation" }).getByRole("link", { name: "Get started" })).toBeVisible();
    } else {
      await expect(page.getByRole("link", { name: "Get started" }).first()).toBeVisible();
    }
    await expect(page.getByRole("banner").getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
    if (width < 768) {
      const tabs = page.getByRole("navigation", { name: "Quick navigation" });
      await expect(tabs).toBeVisible();
      await expect(tabs.getByRole("button", { name: "Search events" })).toBeVisible();
      const location = page.getByRole("button", { name: /Choose location/ });
      await expect(location).toBeVisible();
      await location.click();
      await expect(page.getByRole("dialog", { name: "Choose discovery location" })).toBeVisible();
    } else {
      await expect(page.getByRole("navigation", { name: "Quick navigation" })).toBeHidden();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("search shortcut opens the palette and Escape restores focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Search events" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Search Raunak events" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("/");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Search events, venues or organizers" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
