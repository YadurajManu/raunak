import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import sharp from "sharp";

async function main() {
  const base = new URL(process.env.DOCS_CAPTURE_URL || "http://localhost:3000");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "Capture only a local development server.");
  await mkdir("public/docs-assets", { recursive: true });
  await mkdir("artifacts/docs-assets", { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("raunak-theme", "light"));
    // Screenshot fixtures never send a booking, search, or provider request.
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/checkin" && route.request().method() === "GET") {
        await route.fulfill({ json: [{
          id: "a49f4ebf-d53c-4e1e-b067-69d92a233bbd",
          holderName: "Sample attendee",
          holderEmail: "attendee@example.test",
          holderPhone: null,
          code: "SAMPLE-NOT-VALID",
          status: "VALID",
          checkedInAt: null,
          order: { status: "PAID" },
          ticketType: { name: "General admission" },
        }] });
      } else await route.fulfill({ status: 200, json: [] });
    });
    for (const screen of ["discover", "organizer", "check-in"]) {
      const response = await page.goto(new URL(`/style-guide/docs-preview?screen=${screen}`, base).href, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200, "Preview must be enabled in development.");
      await page.getByText("SAMPLE DATA · PRODUCT PREVIEW").waitFor();
      await page.evaluate(async () => { await document.fonts.ready; });
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Preview must not overflow horizontally.");
      if (screen === "check-in") {
        await page.getByLabel("Find an attendee manually").fill("Sample");
        await page.getByRole("button", { name: "Find guest" }).click();
        await page.getByText("attendee@example.test", { exact: true }).waitFor();
      }
      const image = await page.locator("[data-docs-preview]").screenshot({ path: `artifacts/docs-assets/${screen}.png`, animations: "disabled" });
      await sharp(image).resize({ width: 1440, withoutEnlargement: true }).webp({ quality: 86 }).toFile(`public/docs-assets/${screen}.webp`);
      console.log(`Captured ${screen} from real components with sample data.`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
