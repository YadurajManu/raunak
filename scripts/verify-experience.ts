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
    await page.evaluate(() => {
      document.documentElement.dataset.marketingTheme = "dark";
      localStorage.setItem("raunak-theme", "dark");
      window.dispatchEvent(new Event("raunak-theme"));
    });
    await page.getByRole("heading", { name: "Personal details" }).waitFor();
    const nameBox = await page.getByLabel("Full name").boundingBox();
    const emailBox = await page.getByLabel("Email address").boundingBox();
    assert.ok(nameBox && emailBox && Math.abs(nameBox.y - emailBox.y) < 2, "Name and email inputs must align.");
    assert.equal(await page.locator(".maplibregl-canvas").count(), 0, "Profile maps are optional and collapsed.");
    await page.getByRole("combobox", { name: "City", exact: true }).fill("Pun");
    await page.getByRole("combobox", { name: "City", exact: true }).press("ArrowDown");
    await page.getByRole("combobox", { name: "City", exact: true }).press("Enter");
    assert.equal(await page.getByLabel("State / region").inputValue(), "Maharashtra");
    await page.getByRole("combobox", { name: "City", exact: true }).fill("Pun");
    await page.getByRole("combobox", { name: "City", exact: true }).fill("Pune");
    await page.getByRole("button", { name: "Search city", exact: true }).click();
    await page.getByRole("option", { name: /Pune/ }).first().click();
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
    await page.goto(`/dashboard/events?org=${orgId}`);
    await page.getByRole("heading", { name: "Your next event starts here" }).waitFor();
    await page.screenshot({ path: "artifacts/experience/workspace.png", fullPage: true });
    await page.goto(`/dashboard/events/new?org=${orgId}`);
    await page.waitForLoadState("networkidle");
    await page.locator('select[name="category"]').selectOption("Music & nightlife");
    await page.getByRole("radio", { name: /Online Join/ }).check();
    assert.equal(await page.getByLabel("Venue name").count(), 0);
    await page.getByRole("radio", { name: /In person At/ }).check();
    await page.getByLabel("Event title").fill("A little room for good people");
    await page
      .getByLabel("Short summary")
      .fill("A Raunak experience verification event.");
    await page
      .getByLabel("Description", { exact: true })
      .fill(
        "## Your next good memory\nAn evening of music, conversation and good people.",
      );
    await page.getByLabel("Starts", { exact: true }).fill("2027-06-01T18:00");
    await page.getByLabel("Ends", { exact: true }).fill("2027-06-01T21:00");
    await page.getByLabel("Venue name").fill("The Courtyard");
    await page.getByRole("combobox", { name: "City", exact: true }).fill("Pun");
    await page.getByRole("option", { name: /Pune/ }).click();
    await page.getByLabel("Address", { exact: true }).fill("Pune, Maharashtra");
    assert.equal(await page.locator(".maplibregl-canvas").count(), 0, "Event maps start collapsed.");
    await page.getByRole("button", { name: /Adjust map pin/ }).click();
    await page.locator(".maplibregl-canvas").waitFor();
    const mapBox = await page.locator(".r-small-map .r-map").boundingBox();
    assert.ok(mapBox && mapBox.height <= 185, "The optional map must remain compact.");
    await page.screenshot({ path: "artifacts/experience/create-event.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Mobile form must not overflow.");
    await page.screenshot({ path: "artifacts/experience/create-event-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
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
    await page.getByText("Event documents · 0 PDFs",{exact:true}).click();
    await page.getByLabel("Add a PDF").setInputFiles({
      name: "Programme.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\nEvent programme\n%%EOF"),
    });
    await page.getByRole("link", { name: /Programme.pdf/ }).waitFor();
    console.log("Uploaded event PDF through the organizer UI.");
    const { readFile } = await import("node:fs/promises");
    const bytes = await readFile("tests/fixtures/source.png");
    page.on("response",response=>{if(response.url().endsWith("/api/uploads/confirm")&&response.status()===201)void (async()=>{try{const {id}=await response.json();await processMedia(id);await (await mediaQueue.getJob(id))?.remove();}catch(error){errors.push(String(error));}})();});
    await page.getByRole("button",{name:"＋ Add media",exact:true}).click();
    await page.getByLabel("Choose media files").setInputFiles([{name:"First gallery.png",mimeType:"image/png",buffer:bytes},{name:"Second gallery.png",mimeType:"image/png",buffer:bytes},{name:"Third gallery.png",mimeType:"image/png",buffer:bytes},{name:"Fourth gallery.png",mimeType:"image/png",buffer:bytes},{name:"Fifth gallery.png",mimeType:"image/png",buffer:bytes}]);
    await page.getByRole("button",{name:"Upload images",exact:true}).click();
    await page.getByText("5 completed · 0 waiting",{exact:true}).waitFor({timeout:60000});
    assert.equal(await page.locator(".mm-upload-list progress").count(),0,"Completed files must not keep progress bars.");
    await page.getByRole("button",{name:"Done",exact:true}).click();
    const gallery = await db.eventImage.findMany({where:{eventId,kind:"GALLERY"}});
    assert.equal(gallery.length,5,"Every selected file must upload.");
    for(const image of gallery) {await processMedia(image.id);await (await mediaQueue.getJob(image.id))?.remove();}
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
    await page.getByRole("button",{name:"Refresh media status"}).click();
    const card=page.locator("li").filter({has:page.getByRole("img",{name:"Event poster",exact:true})});
    await card.getByRole("button",{name:"Edit Event poster",exact:true}).click();
    await page.getByRole("button",{name:"Crop / resize"}).click();
    await page.getByRole("radio",{name:"Square 1:1"}).check();
    page.once("dialog",dialog=>dialog.dismiss());
    await page.keyboard.press("Escape");
    await page.getByRole("heading",{name:"Frame your image",exact:true}).waitFor();
    await page.getByRole("button",{name:"Save crop"}).waitFor({state:"visible"});
    await page.getByRole("img",{name:"Crop preview: Event poster"}).waitFor();
    await page.screenshot({path:"artifacts/experience/crop-editor.png"});
    const editedResponse=page.waitForResponse(r=>r.url().endsWith(`/images/${imageId}`)&&r.request().method()==="PATCH");
    await page.getByRole("button",{name:"Save crop"}).click();
    const edited=await (await editedResponse).json();
    assert.equal(edited.crop.aspect,"square");
    await processMedia(imageId);
    await (await mediaQueue.getJob(`${imageId}-${edited.crop.revision}`))?.remove();
    await page.getByRole("button",{name:"Close Image details",exact:true}).click();
    await page.getByRole("button",{name:"Refresh media status"}).click();
    await page.getByRole("button",{name:"Edit First gallery",exact:true}).click();
    await page.getByLabel("Alt text",{exact:true}).fill("A warm welcome");
    await page.getByLabel("Media role",{exact:true}).selectOption("COVER");
    await page.getByRole("button",{name:"Save changes",exact:true}).click();
    await page.getByRole("button",{name:"＋ Add person",exact:true}).click();
    await page.getByLabel("Name",{exact:true}).fill("Aarav Mehta");
    await page.getByLabel("Role / title",{exact:true}).fill("Host");
    await page.getByRole("button",{name:"Choose existing",exact:true}).click();
    await page.getByRole("button",{name:"Use A warm welcome as photo",exact:true}).click();
    await page.getByRole("button",{name:"Save person",exact:true}).click();
    await page.getByText("Aarav Mehta",{exact:true}).waitFor();
    await page.getByRole("button",{name:"＋ Add person",exact:true}).click();
    await page.getByLabel("Name",{exact:true}).fill("Meera Rao");
    await page.getByLabel("Role / title",{exact:true}).fill("Artist");
    await page.getByRole("button",{name:"Save person",exact:true}).click();
    await page.getByLabel("Actions for Meera Rao",{exact:true}).click();
    await page.locator(".mm-people-list li").filter({hasText:"Meera Rao"}).getByRole("button",{name:"Move earlier",exact:true}).click();
    await page.getByText("Lineup order saved.",{exact:true}).waitFor();
    await page.reload();
    await page.getByRole("heading",{name:"Media & lineup",exact:true}).waitFor();
    assert.equal(await page.locator(".mm-people-list li").first().locator("strong").textContent(),"Meera Rao");
    const cover=await db.eventImage.findFirstOrThrow({where:{eventId,kind:"COVER"}});
    assert.equal(cover.alt,"A warm welcome");
    const linked=await db.eventPerson.findFirstOrThrow({where:{eventId,name:"Aarav Mehta"}});
    assert.equal(linked.photoKey,cover.storageKey);
    await page.getByLabel("Actions for Fifth gallery",{exact:true}).focus();
    await page.keyboard.press("Enter");
    const moved=page.waitForResponse(r=>r.url().endsWith("images/order")&&r.request().method()==="PATCH");
    await page.locator(".mm-card").filter({has:page.getByRole("img",{name:"Fifth gallery",exact:true})}).getByRole("button",{name:"Move earlier",exact:true}).click();
    assert.equal((await moved).status(),200);
    await page.waitForFunction(()=>document.querySelectorAll(".mm-drag[draggable=true]").length>0);
    const draggedOrder=page.waitForResponse(r=>r.url().endsWith("images/order")&&r.request().method()==="PATCH");
    await page.getByRole("button",{name:/^Reorder Fifth gallery/}).dragTo(page.locator(".mm-card").filter({has:page.getByRole("img",{name:"Second gallery",exact:true})}));
    assert.equal((await draggedOrder).status(),200);
    await page.getByRole("button",{name:"Edit A warm welcome",exact:true}).click();
    await page.getByRole("button",{name:"Replace image",exact:true}).click();
    await page.getByLabel("Choose media files").setInputFiles({name:"Replacement cover.png",mimeType:"image/png",buffer:bytes});
    await page.getByRole("button",{name:"Upload images",exact:true}).click();
    await page.getByText("1 completed · 0 waiting",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Done",exact:true}).click();
    const replacement=await db.eventImage.findFirstOrThrow({where:{eventId,kind:"COVER"}});
    assert.notEqual(replacement.id,cover.id);
    assert.equal((await db.eventPerson.findUniqueOrThrow({where:{id:linked.id}})).photoKey,replacement.storageKey);
    assert.equal((await db.eventImage.findUniqueOrThrow({where:{id:cover.id}})).kind,"GALLERY");
    await page.locator(".mm-people-list li").filter({hasText:"Meera Rao"}).getByRole("button",{name:"Edit",exact:true}).click();
    await page.getByLabel("Role / title",{exact:true}).fill("Performer");
    await page.getByRole("button",{name:"Upload a photo",exact:true}).click();
    await page.getByLabel("Choose media files").setInputFiles({name:"Portrait photo.png",mimeType:"image/png",buffer:bytes});
    await page.getByRole("button",{name:"Upload images",exact:true}).click();
    await page.getByText("1 completed · 0 waiting",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Done",exact:true}).click();
    await page.getByRole("button",{name:"Save person",exact:true}).click();
    await page.getByText("Performer",{exact:true}).waitFor();
    await page.getByRole("button",{name:"＋ Add media",exact:true}).click();
    await page.getByLabel("Choose media files").setInputFiles({name:"Not an image.txt",mimeType:"text/plain",buffer:Buffer.from("invalid")});
    await page.getByText(/Use JPEG, PNG, WebP/).waitFor();
    await page.getByRole("button",{name:"Remove",exact:true}).click();
    await page.getByLabel("Choose media files").setInputFiles({name:"Second gallery.png",mimeType:"image/png",buffer:bytes});
    await page.getByText(/appears to be in this upload or library/).waitFor();
    assert.equal(await page.locator(".mm-upload-list li").count(),0);
    let held:import("@playwright/test").Route|undefined;
    await page.route("**/original/**",route=>{if(route.request().method()==="PUT"){held=route;return;}return route.continue();});
    await page.getByLabel("Choose media files").setInputFiles({name:"Cancelled photo.png",mimeType:"image/png",buffer:bytes});
    const putStarted=page.waitForRequest(request=>request.method()==="PUT"&&request.url().includes("/original/"));
    await page.getByRole("button",{name:"Upload images",exact:true}).click();
    await putStarted;
    await page.getByRole("button",{name:"Cancel",exact:true}).click();
    await page.getByText(/MB · Cancelled/).waitFor();
    await held?.abort().catch(()=>{});
    await page.unroute("**/original/**");
    await page.getByRole("button",{name:"Remove",exact:true}).click();
    let fail=true;
    await page.route("**/original/**",route=>{if(route.request().method()==="PUT"&&fail){fail=false;return route.abort("failed");}return route.continue();});
    await page.getByLabel("Choose media files").setInputFiles({name:"Retry photo.png",mimeType:"image/png",buffer:bytes});
    await page.getByRole("button",{name:"Upload images",exact:true}).click();
    await page.getByRole("button",{name:"Retry",exact:true}).waitFor();
    await page.getByRole("button",{name:"Retry",exact:true}).click();
    await page.getByText("1 completed · 0 waiting",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Done",exact:true}).click();
    await page.unroute("**/original/**");
    assert.equal(await db.eventImage.count({where:{eventId,alt:"Retry photo"}}),1,"Retry must not create duplicate images.");
    await page.getByLabel("Actions for Retry photo",{exact:true}).click();
    page.once("dialog",dialog=>dialog.accept());
    const deleted=page.waitForResponse(r=>r.url().includes("/images/")&&r.request().method()==="DELETE");
    await page.locator(".mm-card").filter({has:page.getByRole("img",{name:"Retry photo",exact:true})}).getByRole("button",{name:"Delete",exact:true}).click();
    assert.equal((await deleted).status(),200);
    await page.reload();
    await page.getByRole("heading",{name:"Media & lineup",exact:true}).waitFor();
    await page.screenshot({path:"artifacts/media-after-desktop.png",fullPage:true});
    await page.setViewportSize({width:1366,height:768});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const thumbBox=await page.locator(".mm-gallery .mm-thumbnail").first().boundingBox();
    assert.ok(thumbBox&&thumbBox.width<=180,"Gallery thumbnails must stay compact.");
    console.log(`Media gallery thumbnail: ${Math.round(thumbBox.width)}px; five desktop columns, with editing fields hidden by default.`);
    await page.screenshot({path:"artifacts/media-after-laptop.png",fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:"artifacts/media-after-mobile.png",fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
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
    await page.goto(`/dashboard/events/${eventId}/settings`);
    await page.getByRole("heading", { name: "Event link & share preview" }).waitFor();
    const nextSlug = `${event.slug}-share`;
    await page.getByLabel("Event URL name", { exact: true }).fill(nextSlug);
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Save URL", exact: true }).click();
    await page.getByText("Event link saved.", { exact: true }).waitFor();
    const shareHref = await page.getByRole("link", { name: "Share on WhatsApp ↗", exact: true }).getAttribute("href");
    assert.ok(new URL(shareHref!).searchParams.get("text")?.endsWith(`/e/${nextSlug}`));
    await page.reload();
    assert.equal(await page.getByLabel("Event URL name", { exact: true }).inputValue(), nextSlug);
    await page.screenshot({ path: "artifacts/experience/event-sharing.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: "artifacts/experience/event-sharing-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const sharedPage = await context.request.get(`/e/${nextSlug}`, { headers: { "user-agent": "facebookexternalhit/1.1" } });
    const sharedHtml = await sharedPage.text();
    const ogImage = sharedHtml.match(/property="og:image" content="([^"]+)"/);
    assert.ok(ogImage, "Social crawlers must receive an image preview.");
    const preview = await context.request.get(new URL(ogImage[1].replaceAll("&amp;", "&")).pathname);
    assert.equal(preview.status(), 200);
    assert.ok(preview.headers()["content-type"].startsWith("image/"));
    console.log("Event sharing passed: edited URL persists, WhatsApp uses saved URL, public poster preview responds.");
    await page.goto(`/dashboard/events/${eventId}/check-in`);
    await page.getByRole("heading",{name:"Ready to scan"}).waitFor();
    await page.screenshot({path:"artifacts/experience/scanner.png",fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:"artifacts/experience/scanner-mobile.png",fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
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
      .getByRole("link", { name: /A little room for good people/ }).filter({ has: page.getByRole("heading", { name: "A little room for good people" }) })
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
          if(record) { const {deleteImage}=await import("../src/server/media/service");await deleteImage(record.id,eventId,image.id);continue; }
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
      await db.eventPerson.deleteMany({where:{eventId}});
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
