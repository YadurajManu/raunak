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
  const event = await db.event.findFirst({
    where: {
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isTest: false,
      deletedAt: null,
      org: { status: "ACTIVE" },
    },
    include: { org: true },
  });
  assert.ok(event, "A real local published event is required.");
  const browser = await chromium.launch();
  const auth = adminAuth();
  const identity = await auth.createUser({
    email: `toolbar-${randomUUID()}@example.invalid`,
  });
  let userId: string | undefined;
  try {
    const user = await db.user.create({
      data: {
        firebaseUid: identity.uid,
        email: identity.email!,
        name: "Toolbar check",
        onboardingCompletedAt: new Date(),
      },
    });
    userId = user.id;
    const token = await auth.createCustomToken(identity.uid);
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, returnSecureToken: true }),
      },
    );
    assert.equal(response.status, 200);
    const session = await auth.createSessionCookie(
      (await response.json()).idToken,
      { expiresIn: 86400000 },
    );
    const context = await browser.newContext({
      baseURL: base,
      permissions: ["clipboard-read", "clipboard-write"],
    });
    await context.addCookies([
      {
        name: "eventra_session",
        value: session,
        url: base,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await context.addInitScript({
      content: `Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async function(data) { localStorage.setItem("toolbar-share-check", JSON.stringify(data)); }
    });`,
    });
    const page = await context.newPage();
    const route = `/e/${event.slug}`;
    const directory = `artifacts/event-actions-${phase}`;
    await mkdir(directory, { recursive: true });
    await page.goto(route, { waitUntil: "networkidle" });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate((value) => {
          document.documentElement.dataset.marketingTheme = value;
        }, theme);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await page.screenshot({
          path: `${directory}/${width}-${theme}.png`,
          fullPage: true,
        });
        if (phase === "after")
          await page
            .locator(".event-action-toolbar")
            .screenshot({ path: `${directory}/toolbar-${width}-${theme}.png` });
      }
    }
    if (phase === "before") return;
    const toolbar = page.locator(".event-action-toolbar");
    await toolbar
      .getByRole("button", { name: "Save event", exact: true })
      .click();
    await toolbar
      .getByRole("button", { name: "Unsave event", exact: true })
      .waitFor();
    await page.reload();
    assert.equal(
      await toolbar
        .getByRole("button", { name: "Unsave event" })
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.ok(
      await db.savedEvent.findUnique({
        where: { userId_eventId: { userId, eventId: event.id } },
      }),
    );
    await toolbar.getByRole("button", { name: "Unsave event" }).click();
    await toolbar
      .getByRole("button", { name: "Save event", exact: true })
      .waitFor();
    await page.route(`**/api/events/${event.id}/save`, (request) =>
      request.fulfill({ status: 500, body: "{}" }),
    );
    await toolbar
      .getByRole("button", { name: "Save event", exact: true })
      .click();
    await toolbar.getByRole("alert").waitFor();
    assert.equal(
      await toolbar
        .getByRole("button", { name: "Save event", exact: true })
        .isEnabled(),
      true,
    );
    await page.unroute(`**/api/events/${event.id}/save`);
    await toolbar.locator("summary").filter({ hasText: "Calendar" }).click();
    const google = new URL(
      (await toolbar
        .getByRole("link", { name: "Google Calendar" })
        .getAttribute("href"))!,
    );
    const outlook = new URL(
      (await toolbar
        .getByRole("link", { name: "Outlook", exact: true })
        .getAttribute("href"))!,
    );
    assert.equal(google.searchParams.get("text"), event.title);
    assert.equal(google.searchParams.get("ctz"), event.timezone);
    assert.equal(
      outlook.searchParams.get("startdt"),
      event.startsAt.toISOString(),
    );
    const ics = await context.request.get(`/api/events/${event.id}/calendar`);
    assert.equal(ics.status(), 200);
    assert.match(ics.headers()["content-type"], /text\/calendar/);
    assert.match(await ics.text(), /BEGIN:VEVENT/);
    await toolbar.getByRole("link", { name: "Google Calendar" }).focus();
    await page.keyboard.press("Escape");
    assert.equal(await toolbar.locator("details[open]").count(), 0);
    await toolbar.locator("summary").filter({ hasText: "Share" }).click();
    const whatsapp = new URL(
      (await toolbar
        .getByRole("link", { name: "WhatsApp", exact: true })
        .getAttribute("href"))!,
    );
    assert.equal(whatsapp.hostname, "wa.me");
    assert.equal(
      whatsapp.searchParams.get("text"),
      `${event.title}\n${base}${route}`,
    );
    await toolbar
      .getByRole("button", { name: "Copy link", exact: true })
      .click();
    await toolbar
      .getByRole("button", { name: "Copied", exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      `${base}${route}`,
    );
    assert.equal(
      await page.evaluate(() => typeof navigator.share),
      "function",
      "Native sharing test stub must be available",
    );
    await toolbar.getByRole("button", { name: "More sharing options" }).click();
    assert.deepEqual(
      JSON.parse(
        (await page.evaluate(() =>
          localStorage.getItem("toolbar-share-check"),
        ))!,
      ),
      { title: event.title, url: `${base}${route}` },
    );
    await toolbar.locator("summary").filter({ hasText: "Share" }).click();
    await page.getByRole("heading", { name: event.title, exact: true }).click();
    assert.equal(await toolbar.locator("details[open]").count(), 0);
    await toolbar.locator(".eat-organizer").click();
    await page.waitForURL(`**/organizers/${event.org.slug}`);
    const guest = await browser.newContext({ baseURL: base });
    const guestPage = await guest.newPage();
    await guestPage.goto(route);
    await guestPage
      .locator(".event-action-toolbar")
      .getByRole("button", { name: "Save event", exact: true })
      .click();
    await guestPage.waitForURL(/\/login\?next=/);
    assert.equal(new URL(guestPage.url()).searchParams.get("next"), route);
    await guest.close();
    console.log(
      "Event toolbar passed: save/unsave persistence, retry and sign-in; calendar provider data and ICS; clipboard and native share payload; WhatsApp; organizer route; keyboard/menu dismissal; desktop/mobile light/dark without overflow. No messages or calendar events sent.",
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
