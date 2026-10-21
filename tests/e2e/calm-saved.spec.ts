import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("saved card supports optimistic removal, Undo and failure recovery", async ({ page }) => {
  const changes: boolean[] = [];
  let fail = false;
  await page.route("**/api/events/*/save", async route => {
    changes.push(route.request().postDataJSON().saved);
    await route.fulfill({status: fail ? 500 : 200, json:{saved:changes.at(-1)}});
  });
  await page.goto("/style-guide/calm-ui");
  await page.getByRole("button", {name:"Remove from saved"}).click();
  await expect(page.getByRole("button", {name:"Undo"})).toBeVisible();
  await page.getByRole("button", {name:"Undo"}).click();
  await expect(page.getByRole("button", {name:"Remove from saved"})).toHaveAttribute("aria-pressed","true");
  expect(changes).toEqual([false,true]);
  fail = true;
  await page.getByRole("button", {name:"Remove from saved"}).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Could not update saved event. Retry.");
  await expect(page.getByRole("button", {name:"Remove from saved"})).toHaveAttribute("aria-pressed","true");
  await expect(page.getByRole("link", {name:/Share .* WhatsApp/})).toHaveAttribute("href", /wa.me/);
});

test("saved collection is compact, readable and accessible in both themes", async ({page}) => {
  test.setTimeout(90_000);
  await page.emulateMedia({reducedMotion:"reduce"});
  for(const width of [320,375,768,1440]) {
    await page.setViewportSize({width,height:960});
    await page.goto("/style-guide/calm-ui");
    for(const theme of ["light","dark"]) {
      await page.evaluate(t=>document.documentElement.dataset.marketingTheme=t,theme);
      const card=page.locator(".market-card-saved");
      expect((await card.boundingBox())!.width).toBeLessThanOrEqual(360);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const title=card.getByRole("heading");
      const color=await title.evaluate(el=>getComputedStyle(el).color);
      await card.hover();
      expect(await title.evaluate(el=>getComputedStyle(el).color)).toBe(color);
      expect((await new AxeBuilder({page}).include("main").analyze()).violations).toEqual([]);
      if(width!==320) await page.screenshot({path:`/tmp/raunak-calm-after-account-${width}-${theme}.png`,fullPage:true});
    }
  }
});

test("removal refresh waits for the Undo window", async ({page}) => {
  await page.route("**/api/events/*/save", route => route.fulfill({json:{saved:false}}));
  await page.goto("/style-guide/calm-ui");
  await page.clock.install();
  let refreshes = 0;
  page.on("request", request => { if(request.url().includes("/style-guide/calm-ui") && request.headers().rsc === "1") refreshes++; });
  await page.getByRole("button",{name:"Remove from saved"}).click();
  await expect(page.getByRole("button",{name:"Undo"})).toBeEnabled();
  await page.clock.fastForward(7000);
  expect(refreshes).toBe(0);
  await page.clock.fastForward(1100);
  await expect.poll(()=>refreshes).toBeGreaterThan(0);
});

test("failed Undo retains a retry and can restore the event", async ({page}) => {
  let failUndo = true;
  await page.route("**/api/events/*/save", route => {
    const saved = route.request().postDataJSON().saved;
    return route.fulfill({status:saved && failUndo ? 500 : 200,json:{saved}});
  });
  await page.goto("/style-guide/calm-ui");
  await page.getByRole("button",{name:"Remove from saved"}).click();
  await page.getByRole("button",{name:"Undo"}).click();
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button",{name:"Undo"})).toBeEnabled();
  failUndo = false;
  await page.getByRole("button",{name:"Undo"}).click();
  await expect(page.getByRole("button",{name:"Remove from saved"})).toHaveAttribute("aria-pressed","true");
  await expect(page.getByRole("button",{name:"Undo"})).not.toBeVisible();
});

test("shared controls have accessible names and keyboard input", async ({page}) => {
  await page.goto("/style-guide/calm-ui?view=components");
  for(const theme of ["light","dark"]) {
    await page.evaluate(t=>document.documentElement.dataset.marketingTheme=t,theme);
    expect((await new AxeBuilder({page}).include("main").analyze()).violations).toEqual([]);
  }
  await page.getByLabel("Community name").fill("Changed community");
  await expect(page.getByText("You have unsaved changes")).toBeVisible();
  await page.getByRole("button",{name:"Discard"}).click();
  await expect(page.getByText("You have unsaved changes")).not.toBeVisible();
  await page.getByRole("radio",{name:"Mobile",exact:true}).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("radio",{name:"Mobile",exact:true})).toBeChecked();
});
