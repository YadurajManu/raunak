import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import {
  createEvent,
  changeEventStatus,
  duplicateEvent,
  listEvents,
  softDeleteEvent,
} from "@/server/events/service";
import { createTicketType, updateTicketType } from "@/server/tickets/types";
import { assignEventStaff } from "@/server/events/staff";
import { requireEventAccessForUser } from "@/server/rbac/access";

const key = randomUUID().slice(0, 8);
let ownerId: string;
let managerId: string;
let orgId: string;
let eventId: string;

beforeAll(async () => {
  const owner = await db.user.create({
    data: {
      firebaseUid: `event-owner-${key}`,
      email: `event-owner-${key}@example.test`,
    },
  });
  const manager = await db.user.create({
    data: {
      firebaseUid: `event-manager-${key}`,
      email: `event-manager-${key}@example.test`,
    },
  });
  ownerId = owner.id;
  managerId = manager.id;
  const org = await db.organization.create({
    data: {
      slug: `event-org-${key}`,
      name: "Event Org",
      members: {
        create: [
          { userId: ownerId, role: "OWNER" },
          { userId: managerId, role: "MANAGER" },
        ],
      },
    },
  });
  orgId = org.id;
});

afterAll(async () => {
  if (orgId) {
    await db.auditLog.deleteMany({ where: { orgId } });
    await db.event.deleteMany({ where: { orgId } });
    await db.organization.delete({ where: { id: orgId } });
  }
  if (ownerId) await db.user.delete({ where: { id: ownerId } });
  if (managerId) await db.user.delete({ where: { id: managerId } });
});

describe("organizer event workflow", () => {
  it("limits managers to assigned events and publishes a complete event", async () => {
    const start = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const event = await createEvent(ownerId, orgId, {
      title: "Test Gala",
      mode: "IN_PERSON",
      venueName: "Main Hall",
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      capacity: 10,
    });
    eventId = event.id;
    expect(
      (await listEvents(managerId, orgId)).some((item) => item.id === eventId),
    ).toBe(false);
    await expect(
      requireEventAccessForUser(managerId, eventId, ["MANAGER"]),
    ).rejects.toThrow("Access denied");
    await assignEventStaff(ownerId, eventId, { userId: managerId });
    expect(
      (await listEvents(managerId, orgId)).some((item) => item.id === eventId),
    ).toBe(true);
    const type = await createTicketType(managerId, eventId, {
      name: "General",
      pricePaise: 49900,
      quantityTotal: 10,
    });
    await expect(
      updateTicketType(managerId, eventId, type.id, {
        name: "General",
        pricePaise: 49900,
        quantityTotal: 11,
      }),
    ).rejects.toThrow("capacity");
    await db.ticketType.update({
      where: { id: type.id },
      data: { quantityHeld: 2 },
    });
    await expect(
      updateTicketType(managerId, eventId, type.id, {
        name: "General",
        pricePaise: 49900,
        quantityTotal: 1,
      }),
    ).rejects.toThrow("sold and held");
    await db.ticketType.update({
      where: { id: type.id },
      data: { quantityHeld: 0 },
    });
    await expect(
      changeEventStatus(managerId, eventId, "PUBLISHED"),
    ).rejects.toThrow("poster");
    await db.eventImage.create({
      data: {
        eventId,
        kind: "POSTER",
        storageKey: `/seed/test-${key}`,
        variants: { card: { jpeg: "/seed/campus-fest.svg" } },
        mime: "image/svg+xml",
        sizeBytes: 0,
        alt: "Poster",
      },
    });
    const published = await changeEventStatus(managerId, eventId, "PUBLISHED");
    expect(published.status).toBe("PUBLISHED");
    expect((await changeEventStatus(managerId, eventId, "DRAFT")).status).toBe(
      "DRAFT",
    );
  });

  it("duplicates event details, images, and ticket types as a draft", async () => {
    const copy = await duplicateEvent(ownerId, eventId);
    const complete = await db.event.findUniqueOrThrow({
      where: { id: copy.id },
      include: { images: true, ticketTypes: true },
    });
    expect(complete.status).toBe("DRAFT");
    expect(complete.ticketTypes).toHaveLength(1);
    expect(complete.images).toHaveLength(1);
    expect(complete.slug).not.toBe(
      (await db.event.findUniqueOrThrow({ where: { id: eventId } })).slug,
    );
    await softDeleteEvent(ownerId, copy.id);
    expect(
      (await listEvents(ownerId, orgId)).some((item) => item.id === copy.id),
    ).toBe(false);
  });
});
