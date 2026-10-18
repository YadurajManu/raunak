import { expect, test } from "@playwright/test";
import QRCode from "qrcode";
const guest = {
  id: "a49f4ebf-d53c-4e1e-b067-69d92a233bbd",
  holderName: "Aditi Sharma",
  holderEmail: "aditi@example.test",
  holderPhone: "+919876543210",
  code: "ADITI12345",
  status: "VALID",
  checkedInAt: null,
  order: { status: "PAID" },
  ticketType: { name: "General admission" },
};
const detail = {
  ...guest,
  checkedInAt: "2026-10-18T13:30:00Z",
  checkedInBy: { name: "Rohan · Gate 1" },
};
test.beforeEach(async ({ page, request }) => {
  const response = await request.get("/style-guide/check-in");
  test.skip(
    response.status() === 404,
    "Internal component preview is disabled in production.",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
});
test("blocked camera gives actionable guidance and manual check-in remains available", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    });
  });
  await page.route("**/api/checkin?**", (route) =>
    route.fulfill({ json: [guest] }),
  );
  await page.route("**/api/checkin", (route) =>
    route.fulfill({
      json: {
        result: "VALID",
        reason: "Ticket confirmed. Admit one guest.",
        ticket: detail,
      },
    }),
  );
  await page.goto("/style-guide/check-in");
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.getByText("Camera access is blocked")).toBeVisible();
  await expect(page.getByText(/site settings/)).toBeVisible();
  await page.getByRole("button", { name: "Use manual lookup" }).click();
  await expect(page.getByLabel("Find an attendee manually")).toBeFocused();
  await page.getByLabel("Find an attendee manually").fill("Aditi");
  await page.getByRole("button", { name: "Find guest" }).click();
  await page.getByRole("button", { name: /Check in Aditi/ }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome in." }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: /Check in Aditi/ }),
  ).toBeDisabled();
  await expect(
    page.getByText("Admitted: 18 Oct 2026, 7:00 pm", { exact: false }),
  ).toBeVisible();
});
test("duplicate entry shows original time and staff instead of another admission", async ({
  page,
}) => {
  await page.route("**/api/checkin", (route) =>
    route.fulfill({
      json: {
        result: "ALREADY_USED",
        reason:
          "This ticket has already admitted a guest. Do not admit it again.",
        ticket: detail,
      },
    }),
  );
  await page.goto("/style-guide/check-in");
  await page.getByText("QR won’t scan?", { exact: true }).click();
  await page
    .getByLabel("Ticket QR link or signed code")
    .fill("v1.pasted-ticket");
  await page.getByRole("button", { name: "Check ticket", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Already checked in" }),
  ).toBeVisible();
  await expect(page.getByText(/Do not admit it again/)).toBeVisible();
  await expect(page.getByText(/By Rohan/)).toBeVisible();
  await expect(page.getByText(/First entry:/)).toBeVisible();
});
test("failed requests stay unconfirmed and retry safely without concurrent submissions", async ({
  page,
}) => {
  let calls = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/checkin?**", (route) =>
    route.fulfill({ json: [guest] }),
  );
  await page.route("**/api/checkin", async (route) => {
    calls++;
    if (calls === 1) {
      await pending;
      await route.abort("failed");
    } else
      await route.fulfill({
        json: {
          result: "ALREADY_USED",
          reason: "Do not admit it again.",
          ticket: detail,
        },
      });
  });
  await page.goto("/style-guide/check-in");
  await page.getByLabel("Find an attendee manually").fill("Aditi");
  await page.getByRole("button", { name: "Find guest" }).click();
  await page
    .getByRole("button", { name: /Check in Aditi/ })
    .evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
  await expect.poll(() => calls).toBe(1);
  await expect(
    page.getByRole("heading", { name: "Checking ticket…" }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole("heading", { name: "Result not confirmed" }),
  ).toBeVisible();
  await expect(page.getByText(/Do not admit this guest yet/)).toBeVisible();
  await page.getByRole("button", { name: "Retry this ticket" }).click();
  await expect(
    page.getByRole("heading", { name: "Already checked in" }),
  ).toBeVisible();
  expect(calls).toBe(2);
});
test("search changes clear stale results and cancelled bookings cannot check in", async ({
  page,
}) => {
  await page.route("**/api/checkin?**", (route) =>
    route.fulfill({
      json: [{ ...guest, order: { status: "REFUNDED" }, status: "CANCELLED" }],
    }),
  );
  await page.goto("/style-guide/check-in");
  const input = page.getByLabel("Find an attendee manually");
  await input.fill("Aditi");
  await page.getByRole("button", { name: "Find guest" }).click();
  await expect(page.getByText("Booking refunded")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Check in Aditi/ }),
  ).toBeDisabled();
  await input.fill("Different guest");
  await expect(page.getByText("Aditi Sharma", { exact: true })).toHaveCount(0);
  await page.route("**/api/checkin?**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Search is temporarily unavailable. Please retry." },
    }),
  );
  await page.getByRole("button", { name: "Find guest" }).click();
  await expect(page.locator(".r-checkin").getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(
    page.getByText("No matching tickets", { exact: true }),
  ).toHaveCount(0);
});
test("actual QR decoder pauses after a result and detects the next duplicate", async ({
  page,
  context,
}) => {
  const qr = await QRCode.toDataURL("v1.camera-test-ticket", {
    width: 320,
    margin: 4,
  });
  await page.addInitScript(
    ({ qr }) => {
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: async () => {
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext("2d")!;
          const image = new Image();
          image.src = qr;
          await image.decode();
          const draw = () => {
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, 640, 480);
            ctx.drawImage(image, 160, 80, 320, 320);
          };
          draw();
          const stream = canvas.captureStream(15);
          const timer = setInterval(draw, 60);
          const track = stream.getTracks()[0];
          const stop = track.stop.bind(track);
          track.stop = () => {
            clearInterval(timer);
            stop();
            document.documentElement.dataset.cameraStopped = "yes";
          };
          return stream;
        },
      });
    },
    { qr },
  );
  let calls = 0;
  await page.route("**/api/checkin", (route) =>
    route.fulfill({
      json: {
        result: ++calls === 1 ? "VALID" : "ALREADY_USED",
        reason: calls === 1 ? "Admit one guest." : "Do not admit it again.",
        ticket: detail,
      },
    }),
  );
  await page.goto("/style-guide/check-in");
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome in." }),
  ).toBeVisible();
  await expect(page.getByText("Paused · review result")).toBeVisible();
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "Scan next guest" }).click();
  await expect(
    page.getByRole("heading", { name: "Already checked in" }),
  ).toBeVisible();
  expect(calls).toBe(2);
  await context.setOffline(true);
  await expect(page.getByRole("button", { name: "Stop camera" })).toBeEnabled();
  await page.getByRole("button", { name: "Stop camera" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-camera-stopped",
    "yes",
  );
  await context.setOffline(false);
});
test("offline status blocks admission controls without claiming an empty guest list", async ({
  page,
  context,
}) => {
  await page.goto("/style-guide/check-in");
  await page
    .getByRole("button", { name: "Start camera", exact: true })
    .waitFor();
  await context.setOffline(true);
  await expect(page.getByRole("button", { name: "Find guest" })).toBeDisabled();
  await expect(page.locator(".r-checkin").getByRole("alert")).toContainText(
    "reconnect before admitting",
  );
  await expect(
    page.getByText("No matching tickets", { exact: true }),
  ).toHaveCount(0);
  await context.setOffline(false);
  await expect(page.getByRole("button", { name: "Find guest" })).toBeEnabled();
});
test("cancelled camera startup stops a stream that arrives after permission is granted", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const shared = window as Window & { releaseCamera?: () => void };
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        new Promise<MediaStream>((resolve) => {
          shared.releaseCamera = () => {
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 480;
            const stream = canvas.captureStream();
            const track = stream.getTracks()[0],
              stop = track.stop.bind(track);
            track.stop = () => {
              document.documentElement.dataset.lateCameraStopped = "yes";
              stop();
            };
            resolve(stream);
          };
        }),
    });
  });
  await page.goto("/style-guide/check-in");
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await page.getByRole("button", { name: "Cancel camera" }).click();
  await page.evaluate(() =>
    (window as Window & { releaseCamera?: () => void }).releaseCamera?.(),
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-late-camera-stopped",
    "yes",
  );
  await expect(
    page.getByRole("button", { name: "Start camera", exact: true }),
  ).toBeVisible();
});
test("entrance UI fits small screens and both themes", async ({ page }) => {
  await page.goto("/style-guide/check-in");
  await page
    .getByRole("button", { name: "Start camera", exact: true })
    .waitFor();
  for (const width of [320, 390, 768, 1440])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 950 });
      await page.evaluate(
        (theme) =>
          document.documentElement.setAttribute("data-marketing-theme", theme),
        theme,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `artifacts/checkin/entrance-${width}-${theme}.png`,
        fullPage: true,
      });
    }
});
