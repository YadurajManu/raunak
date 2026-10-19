import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { adminAuth } from "../src/server/auth/firebase-admin";
import { db } from "../src/server/db/client";
import { ticketToken } from "../src/server/tickets/qr";

const directory = "artifacts/contrast";
const statePath = `${directory}/fixture.json`;
async function main() {
  const database = new URL(process.env.DATABASE_URL || "");
  if (!["localhost", "127.0.0.1"].includes(database.hostname) || !database.pathname.endsWith("/raunak_theme_review"))
    throw new Error("Contrast fixtures require the disposable local raunak_theme_review database.");
  if (process.argv.includes("--cleanup")) {
    const fixture = JSON.parse(await readFile(statePath, "utf8"));
    await adminAuth().deleteUser(fixture.uid);
    await db.ticket.deleteMany({ where: { order: { buyerId: fixture.userId } } });
    await db.order.deleteMany({ where: { buyerId: fixture.userId } });
    await db.event.deleteMany({ where: { orgId: fixture.orgId } });
    await db.organization.delete({ where: { id: fixture.orgId } });
    await db.user.delete({ where: { id: fixture.userId } });
    for (const file of [statePath, `${directory}/storage.json`, `${directory}/routes.json`]) await unlink(file);
    console.log("Local contrast fixtures and temporary login removed.");
    return;
  }
  await mkdir(directory, { recursive: true });
  const email = `contrast-${randomUUID()}@example.invalid`;
  const auth = await adminAuth().createUser({ email });
  try {
    const custom = await adminAuth().createCustomToken(auth.uid);
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    });
    const { idToken } = await response.json();
    if (!idToken) throw new Error("Could not authenticate the local review account.");
    const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn: 86400000 });
    const user = await db.user.create({ data: { firebaseUid: auth.uid, email, name: "Raunak Review", phone: "+919876543210", city: "Dehradun", onboardingCompletedAt: new Date() } });
    const org = await db.organization.create({ data: { name: "Review workspace", slug: `review-${randomUUID()}`, supportEmail: email, members: { create: { userId: user.id, role: "OWNER" } } } });
    const event = await db.event.create({ data: { orgId: org.id, title: "An evening of music and good company", slug: `contrast-${randomUUID()}`, category: "Arts & culture", summary: "Local accessibility review fixture.", description: "An evening of music, conversation and community.", status: "PUBLISHED", publishedAt: new Date(), city: "Dehradun", venueName: "Review venue", address: "Rajpur Road, Dehradun", lat: 30.3165, lng: 78.0322, startsAt: new Date(Date.now() + 5 * 86400000), endsAt: new Date(Date.now() + 5 * 86400000 + 7200000), ticketTypes: { create: { name: "Early Bird", pricePaise: 1000, quantityTotal: 100 } } } });
    const type = await db.ticketType.findFirstOrThrow({ where: { eventId: event.id } });
    const order = await db.order.create({ data: { buyerId: user.id, eventId: event.id, status: "PAID", buyerName: user.name!, buyerEmail: email, subtotalPaise: 1000, totalPaise: 1000, expiresAt: new Date(Date.now() + 86400000), idempotencyKey: randomUUID(), items: { create: { ticketTypeId: type.id, quantity: 1, unitPricePaise: 1000 } } } });
    const ticket = await db.ticket.create({ data: { orderId: order.id, eventId: event.id, ticketTypeId: type.id, code: `REVIEW-${randomUUID().slice(0, 8)}`, holderName: user.name!, holderEmail: email } });
    await db.savedEvent.create({ data: { userId: user.id, eventId: event.id } });
    const fixture = { uid: auth.uid, userId: user.id, orgId: org.id, eventId: event.id, slug: event.slug, orderId: order.id, ticketId: ticket.id, cookie };
    await writeFile(statePath, JSON.stringify(fixture), { mode: 0o600 });
    await writeFile(`${directory}/storage.json`, JSON.stringify({ cookies: [{ name: "eventra_session", value: cookie, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax", expires: Math.floor(Date.now() / 1000) + 86400 }], origins: [] }), { mode: 0o600 });
    const routes = [
      { name: "home", path: "/", signedOut: true },
      { name: "discover", path: "/discover", signedOut: true },
      { name: "discover-selected", path: "/discover?period=weekend&category=arts-culture", signedOut: true },
      { name: "discover-empty", path: "/discover?q=NoMatchingReview", signedOut: true },
      { name: "discover-filters", path: "/discover", signedOut: true, click: "button.d-filter-trigger" },
      { name: "event", path: `/e/${event.slug}`, signedOut: true },
      { name: "checkout", path: `/checkout/${event.slug}?tickets=${encodeURIComponent(JSON.stringify([{ticketTypeId:type.id,quantity:1}]))}` },
      { name: "login", path: "/login", signedOut: true }, { name: "signup", path: "/signup", signedOut: true },
      { name: "account", path: "/account" }, { name: "account-settings", path: "/account?tab=settings" },
      { name: "profile", path: "/account/profile" }, { name: "wallet", path: "/my-tickets" },
      { name: "ticket", path: `/my-tickets/${ticket.id}` }, { name: "ticket-fullscreen", path: `/my-tickets/${ticket.id}`, click: ".entry-qr-display > button", optional: true },
      { name: "signed-ticket", path: `/t/${ticketToken(ticket.id, event.id)}` },
      { name: "booking", path: `/orders/${order.id}` }, { name: "saved", path: "/saved" },
      { name: "organizer", path: "/dashboard" }, { name: "workspace-events", path: `/dashboard/events?org=${org.id}` },
      { name: "new-event", path: `/dashboard/events/new?org=${org.id}` },
      ...["", "details", "media", "tickets", "attendees", "check-in", "messages", "team", "settings"].map(tab => ({ name: `event-${tab || "overview"}`, path: `/dashboard/events/${event.id}${tab ? `/${tab}` : ""}` })),
      { name: "workspace-team", path: `/dashboard/team?org=${org.id}` },
      { name: "whatsapp", path: "/dashboard/settings/whatsapp" },
      { name: "message-defaults", path: "/dashboard/settings/messages" },
      { name: "not-found", path: "/this-page-does-not-exist", signedOut: true },
    ];
    await writeFile(`${directory}/routes.json`, JSON.stringify(routes, null, 2), { mode: 0o600 });
    console.log("Created disposable local routes and browser session for contrast review.");
  } catch (error) { await adminAuth().deleteUser(auth.uid); throw error; }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
