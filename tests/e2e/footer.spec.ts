import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { footerConfig, footerVariantForPath } from "../../src/config/footer";

function contrastRatio(color: string, surface: string) {
  const channels = color.match(/[\d.]+/g)!.map(Number);
  const background = surface.match(/[\d.]+/g)!.map(Number);
  const alpha = channels[3] ?? 1;
  const luminance = (values: number[]) =>
    values
      .map((value) => {
        const channel = value / 255;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      })
      .reduce(
        (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
        0,
      );
  const foregroundLuminance = luminance(
    channels
      .slice(0, 3)
      .map((value, index) => value * alpha + background[index] * (1 - alpha)),
  );
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

test("footer keeps every destination, accessible controls and theme behavior", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("raunak-theme", "light"));
  await page.goto("/help", { waitUntil: "domcontentloaded" });
  const footer = page.getByRole("contentinfo");
  await footer.waitFor();
  await footer.scrollIntoViewIfNeeded();
  for (const group of footerConfig.groups) {
    await expect(
      footer.getByRole("heading", { name: group.title, exact: true }),
    ).toBeVisible();
    for (const link of group.links.filter((item) => (item.visibleTo as readonly string[]).includes("anon")))
      await expect(
        footer.locator(".m-footer-links").getByRole("link", { name: link.label, exact: true }),
      ).toHaveAttribute(
        "href",
        link.label === "Host an event" ? "/signup?intent=organizer" : link.href,
      );
  }
  await expect(
    footer.getByText(/Made in India, for events everywhere\./),
  ).toBeVisible();
  await expect(footer).toContainText(`© ${new Date().getFullYear()} Raunak`);
  const first = footer.getByRole("link", { name: "How it works", exact: true });
  await first.focus();
  await expect(first).toBeFocused();
  expect(
    await first.evaluate((element) =>
      parseFloat(getComputedStyle(element).outlineWidth),
    ),
  ).toBeGreaterThan(0);
  await footer.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-marketing-theme",
    "dark",
  );
  await footer.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-marketing-theme",
    "light",
  );
  await footer.getByRole("button", { name: /back to top/i }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(3);
});

test("footer stays compact, ink-black and unclipped at every requested viewport in both themes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/help", { waitUntil: "domcontentloaded" });
  const footer = page.getByRole("contentinfo");
  await footer.waitFor();
  await page.evaluate(() => document.fonts.ready);
  for (const width of [375, 768, 1024, 1440])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 950 });
      await page.evaluate((theme) => {
        document.documentElement.setAttribute("data-marketing-theme", theme);
        localStorage.setItem("raunak-theme", theme);
        window.dispatchEvent(new Event("raunak-theme"));
      }, theme);
      await footer.scrollIntoViewIfNeeded();
      const measurement = await footer.evaluate((element) => {
        const rectangle = element.getBoundingClientRect();
        const divider = element.querySelector(".m-footer-stub")!;
        const main = document.querySelector("main")!;
        const links = [...element.querySelectorAll("a")].map((link) => {
          const box = link.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
          };
        });
        return {
          background: getComputedStyle(element).backgroundColor,
          height: rectangle.height,
          gap:
            divider.getBoundingClientRect().top + 12 - main.getBoundingClientRect().bottom,
          dividerWidth: divider.getBoundingClientRect().width,
          overflow: document.documentElement.scrollWidth > innerWidth,
          clipped: links.some(
            (link) =>
              link.left < 0 ||
              link.right > innerWidth ||
              link.top < rectangle.top ||
              link.bottom > rectangle.bottom,
          ),
          textColors: [
            ...element.querySelectorAll(
              "a, h2, .m-footer-utility p, .m-footer-trust",
            ),
          ].map((item) => ({ color: getComputedStyle(item).color, background: getComputedStyle(item).backgroundColor, selector: item.className || item.tagName })),
        };
      });
      expect(measurement.background).toBe("rgb(20, 18, 15)");
      for (const item of measurement.textColors)
        expect(contrastRatio(item.color, item.background === "rgba(0, 0, 0, 0)" ? measurement.background : item.background), `footer text color ${item.color} at ${item.selector}`).toBeGreaterThanOrEqual(4.5);
      expect(measurement.overflow).toBe(false);
      expect(measurement.clipped).toBe(false);
      expect(measurement.dividerWidth).toBeGreaterThan(width * 0.75);
      expect(measurement.gap).toBeGreaterThanOrEqual(0);
      expect(measurement.gap).toBeLessThanOrEqual(80);
      await mkdir("artifacts/footer", { recursive: true });
      await page.screenshot({
        path: `artifacts/footer/after-${width}-${theme}.png`,
        fullPage: true,
      });
      await footer.screenshot({
        path: `artifacts/footer/footer-${width}-${theme}.png`,
      });
    }
});

test("footer Product links reach the actual landing-page sections from Discover", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const footer = page.getByRole("contentinfo");
  await footer.getByRole("link", { name: "How it works", exact: true }).click();
  await expect(page).toHaveURL(/\/#how-it-works$/);
  await expect(page.locator("#how-it-works")).toBeVisible();
});

test("full footer has no automated accessibility violations", async ({ page }) => {
  await page.goto("/help", { waitUntil: "domcontentloaded" });
  await expect(page.locator("footer.m-footer")).toBeAttached();
  const results = await new AxeBuilder({ page }).include("footer.m-footer").analyze();
  expect(results.violations).toEqual([]);
});

test("public footer links resolve to a page or a valid section", async ({ request }) => {
  const destinations = new Set<string>();
  for (const group of footerConfig.groups)
    for (const link of group.links)
      if ((link.visibleTo as readonly string[]).includes("anon"))
        destinations.add(link.label === "Host an event" ? "/signup?intent=organizer" : link.href.split("#")[0]);
  for (const destination of destinations) {
    const response = await request.get(destination);
    expect(response.status(), destination).toBeLessThan(400);
  }
});

test("checkout and sign-in use the compact footer while organizer tools omit it", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("footer.m-footer-minimal")).toBeVisible();
  await expect(page.locator("footer.m-footer")).toHaveCount(0);
  expect(footerVariantForPath("/dashboard/events")).toBe("none");
  expect(footerVariantForPath("/checkin/scan")).toBe("none");
});
