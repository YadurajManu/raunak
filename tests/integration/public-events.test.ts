import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { discoverEvents, publicEvent } from "@/server/public/events";

const key = randomUUID().slice(0, 8);
let orgId: string;
afterAll(async () => {
  if (orgId) {
    await db.event.deleteMany({ where: { orgId } });
    await db.organization.delete({ where: { id: orgId } });
  }
});

describe("public event visibility", () => {
  it("shows a published unlisted event by URL but excludes it from discovery", async () => {
    const org = await db.organization.create({ data: { name: "Private Organizers", slug: `private-${key}` } });
    orgId = org.id;
    const event = await db.event.create({ data: { orgId, slug: `unlisted-${key}`, title: "Private Concert", startsAt: new Date(Date.now() + 86400000), endsAt: new Date(Date.now() + 90000000), status: "PUBLISHED", visibility: "UNLISTED" } });
    expect((await publicEvent(event.slug))?.id).toBe(event.id);
    expect((await discoverEvents({ q: "Private Concert" })).some(item => item.id === event.id)).toBe(false);
    await db.event.update({ where: { id: event.id }, data: { status: "DRAFT" } });
    expect(await publicEvent(event.slug)).toBeNull();
  });
});
