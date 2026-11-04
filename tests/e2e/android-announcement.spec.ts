import { expect, test } from "@playwright/test";

test("Android announcement appears after the hero and stays dismissed", async ({ page }) => {
  await page.goto("/");
  const announcement = page.getByRole("complementary", { name: "Raunak Android app announcement" });
  await expect(announcement).toBeHidden();
  await page.locator(".m-hero").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.querySelector(".m-hero")!.getBoundingClientRect().bottom + window.scrollY + 100));
  await expect(announcement).toBeVisible();
  await expect(announcement.getByRole("link", { name: /Download the app/ })).toHaveAttribute("href", "/downloads/raunak-v1.0.0.apk");
  await announcement.getByRole("button", { name: "Dismiss Android app announcement" }).click();
  await expect(announcement).toBeHidden();
  await page.reload();
  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect(announcement).toBeHidden();
});
