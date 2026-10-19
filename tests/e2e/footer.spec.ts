import { expect, test } from "@playwright/test";
import { marketing } from "../../src/config/marketing";

function contrastOnInk(color: string) {
  const channels = color.match(/[\d.]+/g)!.map(Number);
  const alpha = channels[3] ?? 1;
  const background = [15, 14, 12];
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
  return (
    (luminance(
      channels
        .slice(0, 3)
        .map((value, index) => value * alpha + background[index] * (1 - alpha)),
    ) +
      0.05) /
    (luminance(background) + 0.05)
  );
}

test("footer keeps every destination, accessible controls and theme behavior", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("raunak-theme", "light"));
  await page.goto("/discover?q=footer-no-matching-event");
  const footer = page.getByRole("contentinfo");
  await footer.scrollIntoViewIfNeeded();
  for (const group of marketing.footer) {
    await expect(
      footer.getByRole("heading", { name: group.label, exact: true }),
    ).toBeVisible();
    for (const link of group.links)
      await expect(
        footer.getByRole("link", { name: link.label, exact: true }),
      ).toHaveAttribute(
        "href",
        link.href.startsWith("#") ? `/${link.href}` : link.href,
      );
  }
  await expect(
    footer.getByText("Made in India, for events everywhere.", { exact: true }),
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
  await footer
    .getByRole("button", { name: "Switch to dark mode", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-marketing-theme",
    "dark",
  );
  await footer
    .getByRole("button", { name: "Switch to light mode", exact: true })
    .click();
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
  await page.goto("/discover?q=footer-no-matching-event");
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
        const divider = element.querySelector(".m-footer-divider")!;
        const empty = document.querySelector(".d-discovery-empty")!;
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
            divider.getBoundingClientRect().top +
            8 -
            empty.getBoundingClientRect().bottom,
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
              "a, h3, .m-footer-utility p, .m-footer-bottom",
            ),
          ].map((item) => getComputedStyle(item).color),
        };
      });
      expect(measurement.background).toBe("rgb(15, 14, 12)");
      for (const color of measurement.textColors)
        expect(contrastOnInk(color)).toBeGreaterThanOrEqual(4.5);
      expect(measurement.overflow).toBe(false);
      expect(measurement.clipped).toBe(false);
      expect(measurement.height).toBeLessThan(width < 600 ? 610 : 440);
      expect(measurement.dividerWidth).toBeGreaterThan(width * 0.75);
      expect(measurement.gap).toBeGreaterThanOrEqual(
        width < 600 ? 23 : width < 1100 ? 39 : 55,
      );
      expect(measurement.gap).toBeLessThanOrEqual(
        width < 600 ? 40 : width < 1100 ? 64 : 82,
      );
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
  await page.goto("/discover");
  const footer = page.getByRole("contentinfo");
  await footer.getByRole("link", { name: "How it works", exact: true }).click();
  await expect(page).toHaveURL(/\/#how-it-works$/);
  await expect(page.locator("#how-it-works")).toBeVisible();
});
