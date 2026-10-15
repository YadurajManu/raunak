import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { db } from "../src/server/db/client";
import { adminAuth } from "../src/server/auth/firebase-admin";

async function main() {
  const base = process.env.AUTH_SMOKE_URL || "http://localhost:3002";
  assert.ok(
    ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
    "Use the matching local application only.",
  );
  const key = randomUUID(),
    email = `polish-${key}@example.invalid`,
    password = randomUUID();
  const auth = adminAuth(),
    identity = await auth.createUser({ email, password });
  const browser = await chromium.launch();
  let userId: string | undefined,
    orgId: string | undefined,
    eventId: string | undefined;
  try {
    const user = await db.user.create({
      data: {
        firebaseUid: identity.uid,
        email,
        name: "Local UI review",
        onboardingCompletedAt: new Date(),
      },
    });
    userId = user.id;
    const org = await db.organization.create({
      data: {
        name: "Local UI workspace",
        slug: key,
        members: { create: { userId, role: "OWNER" } },
      },
    });
    orgId = org.id;
    const event = await db.event.create({
      data: {
        orgId,
        title: "Local UI review event",
        slug: key,
        isTest: true,
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
      },
    });
    eventId = event.id;
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    assert.equal(response.status, 200);
    const session = await auth.createSessionCookie(
      (await response.json()).idToken,
      { expiresIn: 86400000 },
    );
    const context = await browser.newContext({ baseURL: base });
    await context.addCookies([
      {
        name: "eventra_session",
        value: session,
        url: base,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();
    const phase = process.env.UI_CAPTURE_PHASE || "after";
    const directory = `artifacts/universal-${phase}`;
    await mkdir(directory, { recursive: true });
    const headerMetrics = new Map<string, { height: number; logoX: number }>();
    const routes = [
      ["account", "/account"],
      ["profile", "/account/profile"],
      ["workspaces", "/dashboard"],
      ["events", `/dashboard/events?org=${orgId}`],
      ["create-event", `/dashboard/events/new?org=${orgId}`],
      ["event-media", `/dashboard/events/${eventId}/media`],
      ["event-tickets", `/dashboard/events/${eventId}/tickets`],
      ["discover", "/discover"],
      ["wallet", "/my-tickets"],
      ["saved", "/saved"],
      ...(phase === "after"
        ? [
            ["event-overview", `/dashboard/events/${eventId}`],
            ["event-details", `/dashboard/events/${eventId}/details`],
            ["event-settings", `/dashboard/events/${eventId}/settings`],
            ["workspace-team", `/dashboard/team?org=${orgId}`],
            ["invitation", "/accept-invite/local-ui-invitation-not-real"],
          ]
        : []),
    ];
    for (const [name, route] of routes) {
      await page.goto(route, { waitUntil: "networkidle" });
      await page.locator("h1").first().waitFor();
      for (const [viewport, width, height, theme] of [
        ["desktop", 1440, 1000, "light"],
        ["tablet", 820, 1180, "light"],
        ["mobile", 390, 844, "dark"],
      ] as const) {
        await page.setViewportSize({ width, height });
        await page.evaluate((theme) => {
          document.documentElement.dataset.marketingTheme = theme;
          window.dispatchEvent(new Event("raunak-theme"));
        }, theme);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${name} overflows ${viewport}`,
        );
        await page.screenshot({
          path: `${directory}/${name}-${viewport}.png`,
          fullPage: true,
        });
        if (phase === "after") {
          assert.equal(
            await page.locator("[data-global-navbar]").count(),
            1,
            `${name} needs exactly one global navbar`,
          );
          assert.equal(
            await page.locator(".r-account-header,.m-nav").count(),
            0,
            `${name} must not duplicate headers`,
          );
          assert.equal(await page.locator(".r-profile-menu").count(), 1);
          const box = await page.locator("[data-global-navbar]").boundingBox();
          const logo = await page
            .getByRole("link", { name: "Raunak home", exact: true })
            .boundingBox();
          assert.ok(box && logo);
          const expected = headerMetrics.get(viewport);
          if (expected) {
            assert.ok(
              Math.abs(expected.height - box.height) < 1,
              `${name} header height differs`,
            );
            assert.ok(
              Math.abs(expected.logoX - logo.x) < 1,
              `${name} logo alignment differs`,
            );
          } else
            headerMetrics.set(viewport, { height: box.height, logoX: logo.x });
        }
      }
      if (["discover", "wallet", "saved"].includes(name)) {
        if (phase === "after")
          await page
            .getByRole("button", { name: "Open navigation menu" })
            .click();
        const nav = page.getByRole("navigation", { name: "Main navigation" });
        for (const label of ["Discover events", "My tickets", "Saved"])
          assert.ok(
            await nav
              .getByRole("link", { name: label, exact: true })
              .isVisible(),
          );
        assert.equal(await nav.locator('[aria-current="page"]').count(), 1);
      }
      if (name === "event-media" || name === "event-tickets") {
        const nav = page.getByRole("navigation", { name: "Event sections" });
        assert.equal(await nav.locator('[aria-current="page"]').count(), 1);
        assert.equal(
          await nav.locator('[aria-current="page"]').textContent(),
          name === "event-media" ? "Media" : "Tickets",
        );
      }
      if (name === "workspaces")
        assert.equal(
          await page
            .getByRole("link", { name: /^Workspaces/ })
            .getAttribute("aria-current"),
          "page",
        );
      if (phase === "after" && name === "account") {
        const trigger = page.getByLabel("Open profile menu");
        await trigger.click();
        await page.keyboard.press("Escape");
        assert.equal(
          await page.locator(".r-profile-menu").getAttribute("open"),
          null,
        );
        await trigger.click();
        await page
          .locator("#site-content")
          .click({ position: { x: 5, y: 150 } });
        assert.equal(
          await page.locator(".r-profile-menu").getAttribute("open"),
          null,
        );
      }
      if (phase === "after" && name === "invitation") {
        await page.route("**/api/invites/**/accept", (route) => route.abort());
        await page.getByRole("button", { name: "Accept invitation ↗" }).click();
        await page.getByRole("alert").waitFor();
        assert.equal(
          await page
            .getByRole("button", { name: "Accept invitation ↗" })
            .isEnabled(),
          true,
        );
      }
    }
    if (phase === "after") {
      await page.goto("/account");
      await page.getByLabel("Open profile menu").click();
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await page.waitForURL(/\/login/);
      assert.equal(await page.locator("[data-global-navbar]").count(), 0);
      await page.goto("/discover", { waitUntil: "networkidle" });
      assert.equal(await page.locator("[data-global-navbar]").count(), 1);
      assert.equal(await page.locator(".r-profile-menu").count(), 0);
      assert.equal(
        await page
          .getByRole("link", { name: "Sign in", exact: true })
          .isVisible(),
        true,
      );
    }
    console.log(
      `Navigation passed: ${routes.length} attendee/organizer pages, identical header heights and logo alignment, desktop/tablet/mobile, light/dark layouts, active navigation, profile dismissal and logout. Local disposable fixtures only.`,
    );
  } finally {
    await browser.close();
    if (eventId) await db.event.delete({ where: { id: eventId } });
    if (orgId) await db.organization.delete({ where: { id: orgId } });
    if (userId) await db.user.delete({ where: { id: userId } });
    await auth.deleteUser(identity.uid);
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Site polish check failed",
  );
  process.exitCode = 1;
});
