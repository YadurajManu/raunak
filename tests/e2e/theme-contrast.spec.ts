import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const width of [375, 768, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`public shell, logo and text pass contrast in ${theme} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem("raunak-theme", selectedTheme);
      }, theme);
      await page.goto("/login");
      await expect(page.locator("html")).toHaveAttribute(
        "data-marketing-theme",
        theme,
      );

      if (width >= 768) {
        const visibleMark = page.locator(".brand-mark:visible").first();
        const lightMark = visibleMark.locator(".brand-mark-light");
        const darkMark = visibleMark.locator(".brand-mark-dark");
        await expect(theme === "dark" ? darkMark : lightMark).toBeVisible();
        await expect(theme === "dark" ? lightMark : darkMark).toBeHidden();
      }

      const contrast = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .include(".marketing")
        .analyze();
      expect(
        contrast.violations.filter((violation) => violation.id === "color-contrast"),
      ).toEqual([]);
      await page.screenshot({
        path: `artifacts/theme-audit/login-${width}-${theme}.png`,
        fullPage: true,
      });
    });
  }
}
