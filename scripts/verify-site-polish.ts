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
    await mkdir("artifacts/site-polish", { recursive: true });
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
          path: `artifacts/site-polish/${name}-${viewport}.png`,
          fullPage: true,
        });
      }
      if (["discover", "wallet", "saved"].includes(name)) {
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
    }
    console.log(
      "Site polish passed: 10 attendee/organizer pages, desktop/tablet/mobile, light/dark layouts, no horizontal overflow, visible mobile discovery links and correct active navigation. Local disposable fixtures only.",
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
