/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, it } from "vitest";
import { eventCategories } from "@/config/event-options";
const seed = require("../../seed-raunak-events.js");
const config = () => seed.options({ SEED_START_DATE: "2030-01-01" }, []);

describe("Raunak demo seed", () => {
  it("builds 12 complete listings, exact capacity inventories and single-admission tiers", () => {
    const events = seed.buildEvents(config());
    expect(events).toHaveLength(12);
    expect(new Set(events.map((e: { id: string }) => e.id)).size).toBe(12);
    expect(
      events.filter(
        (e: { organizerEmail: string }) =>
          e.organizerEmail === "yadurajsingham@gmail.com",
      ),
    ).toHaveLength(6);
    for (const e of events) {
      expect(e.title).toMatch(/^\[DEMO\]/);
      expect(e.description).toContain(seed.MARKER);
      expect(e.description).toContain("## FAQs");
      expect(eventCategories).toContain(e.category);
      expect(e.isTest).toBe(true);
      expect(e.status).toBe("DRAFT");
      expect(e.startsAt < e.endsAt).toBe(true);
      expect(e.images).toHaveLength(4);
      expect(e.images[0].kind).toBe("POSTER");
      expect(e.images.map((i: { sortOrder: number }) => i.sortOrder)).toEqual([
        0, 1, 2, 3,
      ]);
      expect(e.ticketTypes).toHaveLength(3);
      expect(
        e.ticketTypes.reduce(
          (sum: number, t: { quantityTotal: number }) => sum + t.quantityTotal,
          0,
        ),
      ).toBe(e.capacity);
      for (const t of e.ticketTypes) {
        expect(Number.isInteger(t.pricePaise)).toBe(true);
        expect(t.description).toContain("Admits one person");
        expect(t.quantityTotal).toBeGreaterThanOrEqual(t.maxPerOrder);
      }
    }
    expect(
      events.some((e: { ticketTypes: { pricePaise: number }[] }) =>
        e.ticketTypes.some((t) => t.pricePaise === 0),
      ),
    ).toBe(true);
    expect(
      events.some((e: { ticketTypes: { pricePaise: number }[] }) =>
        e.ticketTypes.some((t) => t.pricePaise >= 249900),
      ),
    ).toBe(true);
  });
  it("keeps IDs stable across runs and maps licensed CDN media without changing IDs", () => {
    const a = seed.buildEvents(config());
    const b = seed.buildEvents({
      ...config(),
      cdn: "https://cdn.example.test/raunak",
    });
    expect(a.map((e: { id: string }) => e.id)).toEqual(
      b.map((e: { id: string }) => e.id),
    );
    expect(b[0].images[0].variants.card.jpeg).toBe(
      "https://cdn.example.test/raunak/garba/1.jpg",
    );
    expect(a[0].images[0].id).toBe(b[0].images[0].id);
  });
  it("blocks production publishing and requires deliberate sandbox opt-in", () => {
    const c = { ...config(), publish: true, apply: true };
    const env = {
      DATABASE_URL: "postgresql://localhost/seed",
      APP_URL: "http://localhost:3000",
      CASHFREE_ENV: "sandbox",
      SEED_ALLOW_PUBLISH: "true",
    };
    expect(() => seed.assertSafety(c, env)).not.toThrow();
    for (const patch of [
      { CASHFREE_ENV: "production" },
      { NODE_ENV: "production" },
      { APP_URL: "https://raunak.yaduraj.me" },
      { DATABASE_URL: "postgresql://remote.example/seed" },
      { SEED_ALLOW_PUBLISH: "false" },
    ])
      expect(() => seed.assertSafety(c, { ...env, ...patch })).toThrow();
    expect(() =>
      seed.assertSafety(
        { ...c, publish: false },
        { ...env, NODE_ENV: "production" },
      ),
    ).toThrow();
    expect(() =>
      seed.assertSafety(
        { ...c, publish: false },
        {
          ...env,
          NODE_ENV: "production",
          SEED_ALLOW_PRODUCTION_DRAFTS: "true",
        },
      ),
    ).not.toThrow();
  });
  it("rejects invalid flags, dates, emails and unsafe CDN paths", () => {
    expect(() => seed.options({}, ["--aply"])).toThrow();
    expect(() => seed.options({}, ["--apply", "--dry-run"])).toThrow();
    expect(() => seed.options({ SEED_START_DATE: "2030-02-31" }, [])).toThrow();
    expect(() =>
      seed.options({ SEED_ORGANIZER_EMAILS: "invalid" }, []),
    ).toThrow();
    expect(() =>
      seed.options(
        { SEED_IMAGE_CDN_BASE: "https://user:pass@example.test" },
        [],
      ),
    ).toThrow();
    expect(() =>
      seed.buildEvents({ ...config(), start: "2000-01-01" }),
    ).toThrow();
    expect(() =>
      seed.buildEvents({ ...config(), start: "2000-01-01", cleanup: true }),
    ).not.toThrow();
  });
});
