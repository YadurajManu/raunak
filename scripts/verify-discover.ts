import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const base = process.env.AUTH_SMOKE_URL || "http://localhost:3002";
async function main() {
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width:1440,height:1000 } });
  await page.addInitScript(() => localStorage.setItem("raunak-theme", "dark"));
  await page.goto(`${base}/discover`);
  await page.waitForLoadState("networkidle");
  assert.equal(await page.getByRole("combobox", { name:"Where" }).inputValue(), "");
  await page.screenshot({path:"artifacts/discover-after-desktop.png",fullPage:true});
  await page.getByRole("combobox",{name:"Where"}).fill("Pun");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal(await page.getByRole("combobox",{name:"Where"}).inputValue(),"Pune");
  await page.getByRole("button",{name:/Find events/}).click();
  await page.waitForURL("**/discover?**");
  await page.getByRole("combobox",{name:"Where"}).focus();
  await page.getByRole("option",{name:/Pune Recent/}).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("link",{name:"Tomorrow",exact:true}).click();
  await page.waitForURL("**period=tomorrow**");
  assert.equal(new URL(page.url()).searchParams.get("city"),"Pune");
  await page.getByRole("link",{name:"Clear all filters"}).click();
  await page.waitForURL("**/discover");
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({path:"artifacts/discover-after-mobile.png",fullPage:true});
  await page.setViewportSize({width:820,height:1180});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log("Discover passed: all cities default, keyboard autocomplete, recent cities, date/query preservation, clear filters, desktop/mobile/tablet layouts.");
} finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
