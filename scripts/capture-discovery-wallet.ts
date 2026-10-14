import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

async function main() {
  const base = process.env.CAPTURE_URL || "http://localhost:3002";
  const label = process.env.CAPTURE_LABEL || "after";
  await mkdir("artifacts/discovery-wallet", { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [viewport, width, height] of [
      ["desktop", 1440, 1000],
      ["mobile", 390, 844],
    ] as const) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      for (const route of ["discover", "my-tickets"]) {
        await page.goto(`${base}/${route}`, { waitUntil: "networkidle" });
        assert.equal(await page.locator("h1").count(), 1);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${route} overflows ${viewport}`,
        );
        await page.screenshot({
          path: `artifacts/discovery-wallet/${label}-${route}-${viewport}.png`,
          fullPage: true,
        });
        if (label === "after") {
          await page.evaluate(() => {
            document.documentElement.setAttribute(
              "data-marketing-theme",
              "dark",
            );
          });
          await page.screenshot({
            path: `artifacts/discovery-wallet/${label}-${route}-${viewport}-alternate-theme.png`,
            fullPage: true,
          });
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`Captured ${label} desktop and mobile discovery/wallet pages.`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
