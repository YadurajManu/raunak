import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { db } from "../src/server/db/client";
import { adminAuth } from "../src/server/auth/firebase-admin";

async function main() {
  const base = process.env.AUTH_SMOKE_URL || "http://localhost:3002";
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
  const phase = process.env.UI_CAPTURE_PHASE || "after";
  const directory = `artifacts/compact-navbar-${phase}`;
  await mkdir(directory, { recursive: true });
  const auth = adminAuth(),
    email = `navbar-${randomUUID()}@example.invalid`,
    password = randomUUID();
  const identity = await auth.createUser({ email, password });
  const browser = await chromium.launch();
  let userId: string | undefined;
  try {
    const user = await db.user.create({
      data: {
        firebaseUid: identity.uid,
        email,
        name: "Navigation review",
        onboardingCompletedAt: new Date(),
      },
    });
    userId = user.id;
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    assert.equal(response.status, 200);
    const cookie = await auth.createSessionCookie(
      (await response.json()).idToken,
      { expiresIn: 86400000 },
    );
    for (const signedIn of [false, true]) {
      const context = await browser.newContext({
        baseURL: base,
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      if (signedIn)
        await context.addCookies([
          {
            name: "eventra_session",
            value: cookie,
            url: base,
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);
      const page = await context.newPage();
      for (const width of [320, 375, 390, 768, 1366, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const theme of ["light", "dark"]) {
          for (const route of signedIn
            ? ["/discover", "/account"]
            : ["/", "/discover"]) {
            await page.goto(route, { waitUntil: "networkidle" });
            await page.evaluate((value) => {
              document.documentElement.dataset.marketingTheme = value;
              localStorage.setItem("raunak-theme", value);
              window.dispatchEvent(new Event("raunak-theme"));
            }, theme);
            const header = page.locator("[data-global-navbar]");
            assert.equal(await header.count(), 1);
            const metrics = await header.evaluate((element) => {
              const logo = element.querySelector(".gnav-logo")!;
              const theme = element.querySelector(
                "button[aria-label^='Use ']",
              )!;
              const themeStyle = getComputedStyle(theme);
              return {
                height: element.getBoundingClientRect().height,
                rootFont: getComputedStyle(document.documentElement).fontSize,
                scale: visualViewport?.scale,
                logo: { font: getComputedStyle(logo).fontSize },
                theme: {
                  height: theme.getBoundingClientRect().height,
                  transform: themeStyle.transform,
                  rotate: themeStyle.rotate,
                  shadow: themeStyle.boxShadow,
                },
              };
            });
            assert.equal(metrics.scale, 1, "Browser must be at 100% zoom");
            assert.equal(metrics.rootFont, "16px");
            assert.ok(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
              `${route} ${width} overflows`,
            );
            if (width === 1440 && route === "/discover" && theme === "light")
              console.log(
                `${signedIn ? "Signed in" : "Signed out"} ${phase} metrics: ${JSON.stringify(metrics)}`,
              );
            if (phase === "after") {
              assert.equal(metrics.height, 64);
              assert.equal(metrics.logo.font, "28px");
              assert.equal(metrics.theme.transform, "none");
              assert.equal(metrics.theme.rotate, "none");
              assert.equal(metrics.theme.shadow, "none");
              assert.equal(metrics.theme.height, width < 1000 ? 44 : 38);
              if (!signedIn)
                assert.equal(
                  (await header
                    .getByRole("link", { name: "Sign in", exact: true })
                    .boundingBox())!.height,
                  width < 1000 ? 44 : 38,
                );
              if (width < 1000) {
                const toggle = page.getByRole("button", {
                  name: "Open navigation menu",
                });
                await toggle.focus();
                await page.keyboard.press("Enter");
                await header
                  .getByRole("link", { name: "Discover events", exact: true })
                  .waitFor();
                await page.keyboard.press("Escape");
                assert.equal(
                  await toggle.evaluate(
                    (element) => element === document.activeElement,
                  ),
                  true,
                );
                await toggle.click();
                await page
                  .locator("#site-content")
                  .click({ position: { x: 5, y: 400 } });
                assert.equal(
                  await toggle.getAttribute("aria-expanded"),
                  "false",
                );
              }
            }
            await page.screenshot({
              path: `${directory}/${signedIn ? "member" : "visitor"}-${route === "/" ? "home" : route.slice(1)}-${width}-${theme}.png`,
            });
          }
        }
      }
      if (phase === "after") {
        await page.goto("/discover", { waitUntil: "networkidle" });
        const toggle = page
          .locator("[data-global-navbar]")
          .getByRole("button", { name: /^Use .* theme$/ });
        const previous = await toggle.getAttribute("aria-label");
        await toggle.click();
        await page.reload({ waitUntil: "networkidle" });
        assert.notEqual(
          await toggle.getAttribute("aria-label"),
          previous,
          "Theme must persist on refresh",
        );
        await page.setViewportSize({ width: 375, height: 900 });
        await page
          .getByRole("button", { name: "Open navigation menu" })
          .click();
        await page
          .getByRole("navigation", { name: "Main navigation" })
          .getByRole("link", { name: "Saved", exact: true })
          .click();
        await page.waitForURL("**/saved");
        assert.equal(
          await page
            .getByRole("button", { name: "Open navigation menu" })
            .getAttribute("aria-expanded"),
          "false",
        );
        assert.equal(
          await page
            .locator('.gnav-links a[href="/saved"]')
            .getAttribute("aria-current"),
          "page",
        );
      }
      await context.close();
    }
    console.log(
      `Navbar ${phase}: six widths, both themes, authenticated and anonymous pages captured at 100% scale.`,
    );
  } finally {
    await browser.close();
    if (userId) await db.user.delete({ where: { id: userId } });
    await auth.deleteUser(identity.uid);
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
