import { test, expect } from "@playwright/test";
import { renderTicketCard } from "../../src/server/tickets/card-renderer";

test("WhatsApp integration supports QR, pairing, mode selection and custom messages on mobile", async ({
  page,
  request,
}) => {
  test.skip(
    (await request.get("/style-guide/whatsapp")).status() === 404,
    "Development-only component preview.",
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let connected = false,
    mode = "ORG_NUMBER",
    saved: Record<string, unknown> | undefined;
  await page.route("**/api/orgs/*/whatsapp", async (route) => {
    const input =
      route.request().method() === "POST"
        ? route.request().postDataJSON()
        : null;
    if (input) {
      if (input.action === "mode") mode = input.mode;
      return route.fulfill({
        json: input.action === "pairing" ? { code: "MOCK1234" } : { ok: true },
      });
    }
    return route.fulfill({
      json: {
        mode,
        enabled: true,
        officialAvailable: true,
        platformAvailable: false,
        gatewayAvailable: true,
        cap: 30,
        day: 1,
        sent: 2,
        connection: {
          id: "22222222-2222-4222-8222-222222222222",
          status: connected ? "CONNECTED" : "QR_PENDING",
          phone: connected ? "••••3210" : null,
          pushName: null,
          lastSeenAt: null,
          connectedAt: null,
          uptimeSeconds: 0,
          qr: connected ? null : "mock-link:browser-test",
          lastError: null,
        },
      },
    });
  });
  await page.route("**/api/orgs/*/messages", async (route) => {
    saved = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true } });
  });
  const sample = await renderTicketCard({
    title: "Sample event",
    date: "24 Oct 2026 · 6 pm IST",
    venue: "Sample venue, Pune",
    holder: "Sample attendee",
    type: "Sample ticket",
    code: "SAMPLE",
    url: "https://example.test/event",
    sample: true,
  });
  await page.route("**/api/orgs/*/messages/preview", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: sample }),
  );
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Cold development compilation can reload before client effects hydrate.
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith(`/api/orgs/11111111-1111-4111-8111-111111111111/whatsapp`) && response.request().method() === "GET", { timeout: 15000 }),
    page.goto("/style-guide/whatsapp"),
  ]);
  await expect(page.getByText("Today: 2 / 30 sends")).toBeVisible();
  await page.getByRole("button", { name: "Connect number" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByAltText(/Scan this QR code/)).toBeVisible();
  await page.screenshot({
    path: "artifacts/whatsapp/linking-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Link with phone number instead").check();
  await page.getByLabel("WhatsApp number", { exact: true }).fill("9876543210");
  await page.getByRole("button", { name: "Get pairing code" }).click();
  await expect(page.getByText("MOCK1234")).toBeVisible();
  connected = true;
  await expect(page.getByRole("dialog")).toContainText("You’re connected");
  await page.keyboard.press("Escape");
  await page.getByLabel("Recipient mobile number").fill("9876543210");
  await page.getByLabel(/I own this number/).check();
  await page.getByRole("button", { name: "Send test message" }).click();
  await expect(page.getByText("Test message sent.")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Channel", exact: true })
    .selectOption("WHATSAPP");
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true }),
  ).toBeEditable();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Hello {{attendee_name}}, see you soon.");
  await page.getByLabel("Ticket PDF", { exact: true }).check();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect
    .poll(() => (saved?.payload as Record<string, unknown>)?.body)
    .toBe("Hello {{attendee_name}}, see you soon.");
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({
    path: "artifacts/whatsapp/settings-mobile-light.png",
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({
    path: "artifacts/whatsapp/settings-mobile-dark.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("WhatsApp integration and message APIs reject signed-out access", async ({
  request,
  baseURL,
}) => {
  const org = "11111111-1111-4111-8111-111111111111";
  expect((await request.get(`/api/orgs/${org}/whatsapp`)).status()).toBe(401);
  expect(
    (
      await request.post(`/api/orgs/${org}/messages`, {
        headers: { origin: baseURL! },
        data: { action: "save", payload: {} },
      })
    ).status(),
  ).toBe(401);
  expect(
    (await request.get(`/api/orgs/${org}/messages/preview`)).status(),
  ).toBe(403);
});
