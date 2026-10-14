import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { adminAuth } from "../src/server/auth/firebase-admin";
import { db } from "../src/server/db/client";
import { storage } from "../src/server/providers/storage/s3";
import { documentsSchema } from "../src/server/events/documents";
import { processMedia } from "../worker/jobs/process-media";
import {
  mediaQueue,
  mediaConnection,
  producerConnection,
} from "../worker/queues";

async function main() {
  const base = process.env.AUTH_SMOKE_URL || "http://localhost:3002";
  const key = randomUUID();
  const email = `experience-${key}@example.invalid`;
  const password = randomUUID();
  const auth = adminAuth();
  const user = await auth.createUser({ email, password, emailVerified: false });
  const browser = await chromium.launch();
  let orgId: string | undefined;
  let eventId: string | undefined;
  try {
    const login = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    const idToken = (await login.json()).idToken;
    assert.ok(idToken);
    const context = await browser.newContext({
      baseURL: base,
      viewport: { width: 1440, height: 1000 },
    });
    const session = await context.request.post("/api/auth/session", {
      headers: { origin: base },
      data: { idToken, rememberMe: true },
    });
    assert.equal(session.status(), 200);
    const profile = await context.request.patch("/api/profile", {
      headers: { origin: base },
      data: {
        name: "Experience Check",
        phone: "+919876543210",
        gender: null,
        location: {
          city: "Pune",
          region: "Maharashtra",
          countryCode: "IN",
          label: "Pune",
          latitude: 18.52,
          longitude: 73.85,
          saveExact: true,
        },
      },
    });
    assert.equal(profile.status(), 200);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page.waitForURL("**/account");
    const saved = await context.storageState();
    const returning = await browser.newContext({
      baseURL: base,
      storageState: saved,
    });
    const returned = await returning.newPage();
    await returned.goto("/login");
    await returned.waitForURL("**/account");
    await returning.close();
    await page.goto("/account/profile");
    await page.getByRole("heading", { name: "Nice to know you." }).waitFor();
    await page.getByLabel("Full name").fill("Experience Check Updated");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByText("Your profile is saved.").waitFor();
    await page
      .getByLabel("Change photo")
      .setInputFiles("tests/fixtures/source.png");
    await page.getByText("Profile photo updated.").waitFor();
    assert.equal(
      (await context.request.get("/api/profile/avatar")).status(),
      200,
    );
    await mkdir("artifacts/experience", { recursive: true });
    await page.screenshot({
      path: "artifacts/experience/profile.png",
      fullPage: true,
    });
    const org = await context.request.post("/api/orgs", {
      headers: { origin: base },
      data: { name: "Experience verification", slug: `experience-${key}` },
    });
    assert.equal(org.status(), 201);
    orgId = (await org.json()).id;
    await page.goto(`/dashboard/events/new?org=${orgId}`);
    await page.getByLabel("Event title").fill("A little room for good people");
    await page
      .getByLabel("Short summary")
      .fill("A Raunak experience verification event.");
    await page
      .getByLabel("Description (Markdown supported)")
      .fill(
        "## Your next good memory\nAn evening of music, conversation and good people.",
      );
    await page.getByLabel("Starts", { exact: true }).fill("2027-06-01T18:00");
    await page.getByLabel("Ends", { exact: true }).fill("2027-06-01T21:00");
    await page.getByLabel("Venue name").fill("The Courtyard");
    await page.getByLabel("City", { exact: true }).fill("Pune");
    await page.getByLabel("Address", { exact: true }).fill("Pune, Maharashtra");
    const creation = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/events") &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Create draft and continue" })
      .click();
    const created = await creation;
    assert.equal(created.status(), 201, await created.text());
    await page.waitForURL("**/media");
    eventId = page.url().match(/events\/([^/]+)/)?.[1];
    assert.ok(eventId);
    console.log("Created event draft through the organizer UI.");
    await page.getByLabel("Add a PDF").setInputFiles({
      name: "Programme.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\nEvent programme\n%%EOF"),
    });
    await page.getByRole("link", { name: /Programme.pdf/ }).waitFor();
    console.log("Uploaded event PDF through the organizer UI.");
    const { readFile } = await import("node:fs/promises");
    const bytes = await readFile("tests/fixtures/source.png");
    const signed = await context.request.post("/api/uploads/presign", {
      headers: { origin: base },
      data: {
        eventId,
        kind: "POSTER",
        mime: "image/png",
        sizeBytes: bytes.length,
      },
    });
    assert.equal(signed.status(), 200, await signed.text());
    const upload = await signed.json();
    assert.equal(
      (
        await fetch(upload.url, {
          method: "PUT",
          headers: { "Content-Type": "image/png" },
          body: bytes,
        })
      ).status,
      200,
    );
    const confirm = await context.request.post("/api/uploads/confirm", {
      headers: { origin: base },
      data: { token: upload.token, alt: "Event poster" },
    });
    assert.equal(confirm.status(), 201);
    const imageId = (await confirm.json()).id;
    await processMedia(imageId);
    console.log("Uploaded and processed event poster.");
    const job = await mediaQueue.getJob(imageId);
    if (job) await job.remove();
    await page.getByRole("link", { name: "Next: set up tickets" }).click();
    await page.waitForURL("**/tickets");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Name", { exact: true }).fill("Good company pass");
    await page.getByLabel("Price (₹)").fill("0");
    await page.getByLabel("Quantity", { exact: true }).fill("25");
    const ticketResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/ticket-types") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Add ticket", exact: true }).click();
    const ticketResult = await ticketResponse;
    assert.equal(ticketResult.status(), 201, await ticketResult.text());
    console.log("Created ticket type through the organizer UI.");
    await page.getByRole("heading", { name: "Good company pass" }).waitFor();
    await page.getByRole("link", { name: "Next: review & publish" }).click();
    const publishResponse = page.waitForResponse((response) =>
      response.url().endsWith("/status"),
    );
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const published = await publishResponse;
    assert.equal(published.status(), 200, await published.text());
    await page
      .getByRole("button", { name: "Unpublish", exact: true })
      .waitFor();
    const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    assert.equal(event.status, "PUBLISHED");
    await page.goto("/discover?city=Pune");
    await page
      .getByRole("heading", {
        name: "A little room for good people",
        exact: true,
      })
      .waitFor();
    await page.screenshot({
      path: "artifacts/experience/discover.png",
      fullPage: true,
    });
    await page
      .getByRole("link", { name: /A little room for good people/ })
      .click();
    await page
      .getByRole("heading", { name: "A little room for good people" })
      .waitFor();
    await page.getByRole("link", { name: /Programme.pdf/ }).waitFor();
    await page.screenshot({
      path: "artifacts/experience/event.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "artifacts/experience/event-mobile.png",
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "Mobile event page should not overflow",
    );
    await page.getByRole("button", { name: "Add Good company pass" }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.waitForURL("**/checkout/**");
    await page
      .getByRole("heading", { name: "Checkout", exact: true })
      .waitFor();
    if (errors.length)
      console.log(
        "Browser errors:",
        errors.map((error) => error.split("\n")[0]),
      );
    assert.deepEqual(errors, []);
    console.log(
      "Browser flow passed: remembered return, profile save/photo, event creation, PDF upload, image processing, tickets, publish, discovery and public event (desktop/mobile).",
    );
  } catch (error) {
    const page = browser.contexts()[0]?.pages()[0];
    if (page) {
      console.log("Failure page:", new URL(page.url()).pathname);
      await page.screenshot({
        path: "artifacts/experience/failure.png",
        fullPage: true,
      });
    }
    throw error;
  } finally {
    await browser.close();
    const record = await db.user.findUnique({
      where: { firebaseUid: user.uid },
    });
    if (eventId) {
      const event = await db.event.findUnique({
        where: { id: eventId },
        include: { images: true },
      });
      if (event) {
        for (const document of documentsSchema.parse(event.documents))
          await storage.delete(document.key);
        for (const image of event.images) {
          await storage.delete(image.storageKey);
          if (image.variants)
            for (const value of Object.values(
              image.variants as Record<string, Record<string, string>>,
            ))
              for (const url of Object.values(value)) {
                const prefix =
                  process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "") + "/";
                if (url.startsWith(prefix))
                  await storage.delete(url.slice(prefix.length));
              }
        }
      }
      await db.eventImage.deleteMany({ where: { eventId } });
      await db.ticketType.deleteMany({ where: { eventId } });
      await db.event.deleteMany({ where: { id: eventId } });
    }
    if (orgId) {
      await db.auditLog.deleteMany({ where: { orgId } });
      await db.organizationMember.deleteMany({ where: { orgId } });
      await db.organization.deleteMany({ where: { id: orgId } });
    }
    if (record?.avatarKey?.startsWith("avatars/"))
      await storage.delete(record.avatarKey);
    await db.user.deleteMany({ where: { firebaseUid: user.uid } });
    await auth.deleteUser(user.uid);
    await mediaQueue.close();
    await producerConnection.quit();
    await mediaConnection.quit();
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message.split("\n")[0] +
          " " +
          (error.stack
            ?.split("\n")
            .find((line) => line.includes("verify-experience.ts:")) || "")
      : "Experience check failed",
  );
  process.exitCode = 1;
});
