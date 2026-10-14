import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const owner = await db.user.upsert({
    where: { firebaseUid: "seed-owner" },
    update: {},
    create: { firebaseUid: "seed-owner", email: "owner@example.test", name: "Aarav Sharma" },
  });
  const org = await db.organization.upsert({
    where: { slug: "acme-club" },
    update: {},
    create: { name: "Acme Club", slug: "acme-club", supportEmail: "hello@example.test", members: { create: { userId: owner.id, role: "OWNER" } } },
  });
  const events = [
    { slug: "campus-fest-2027", title: "Campus Fest 2027", category: "Festival", startsAt: new Date("2027-02-20T10:00:00+05:30"), endsAt: new Date("2027-02-20T22:00:00+05:30"), city: "Pune", venueName: "Acme Campus", poster: "/seed/campus-fest.svg", tickets: [{ name: "General", pricePaise: 49900, quantityTotal: 1000 }, { name: "VIP", pricePaise: 99900, quantityTotal: 100 }] },
    { slug: "design-workshop-2027", title: "Design Workshop 2027", category: "Workshop", startsAt: new Date("2027-03-12T09:00:00+05:30"), endsAt: new Date("2027-03-12T17:00:00+05:30"), city: "Mumbai", venueName: "Acme Studio", poster: "/seed/design-workshop.svg", tickets: [{ name: "Admission", pricePaise: 0, quantityTotal: 60 }] },
  ];
  for (const event of events) {
    await db.event.upsert({
      where: { slug: event.slug },
      update: {},
      create: {
        orgId: org.id, slug: event.slug, title: event.title, category: event.category,
        startsAt: event.startsAt, endsAt: event.endsAt, city: event.city, venueName: event.venueName,
        summary: `${event.title} at ${event.venueName} in ${event.city}.`, status: "PUBLISHED", publishedAt: new Date(),
        images: { create: { kind: "POSTER", storageKey: event.poster, variants: { hero: event.poster, og: event.poster }, mime: "image/svg+xml", sizeBytes: 0, alt: `${event.title} poster` } },
        ticketTypes: { create: event.tickets },
      },
    });
  }
}

main().finally(() => db.$disconnect());
