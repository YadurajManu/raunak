/* eslint-disable @typescript-eslint/no-require-imports */
// Run with Node 24. No application credentials or customer records are generated.
const { createHash } = require("node:crypto");
const { Client } = require("pg");

const MARKER = "RAUNAK_DEMO_SEED_V1";
const PREFIX = "raunak-demo-";
const DEFAULT_EMAILS = ["yadurajsingham@gmail.com", "yaduraj.enc@gmail.com"];
const photo = (id, alt) => ({
  id: String(id),
  alt,
  source: `https://www.pexels.com/photo/${id}/`,
  license: "https://www.pexels.com/license/",
});
const commons = (name, credit, version) => {
  const filename = name.replaceAll(" ", "_");
  const hash = createHash("md5").update(filename).digest("hex");
  return {
    id: name,
    alt: "Garba dancers in traditional dress",
    source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(name)}`,
    url: `https://upload.wikimedia.org/wikipedia/commons/thumb/${hash[0]}/${hash.slice(0, 2)}/${encodeURIComponent(filename)}/960px-${encodeURIComponent(filename)}`,
    credit,
    license: `https://creativecommons.org/licenses/by-sa/${version}/`,
  };
};
const PHOTOS = {
  garba: [
    commons("Garba Folk Dance.jpg", "Saurabh sirohiya", "4.0"),
    commons("Girl playing garba.jpg", "Dameronbaptist", "4.0"),
    commons(
      "A rasa garba dandiya dance, Navratri tradition.jpg",
      "Ed Uthman",
      "2.0",
    ),
    commons("Indian garba night.jpg", "Shubhangi Parganiha", "4.0"),
  ],
  music: [
    photo(7715394, "Acoustic guitarist on stage"),
    photo(7715391, "Guitar performance under coloured lighting"),
    photo(5698261, "Audience enjoying a live guitarist"),
    photo(17509457, "Stage microphone"),
  ],
  pottery: [
    photo(6694304, "People shaping clay in a pottery studio"),
    photo(9304294, "Pottery wheels in a workshop"),
    photo(9304291, "Handmade ceramic dishes and clay shaping"),
    photo(5642002, "Clay modelling tools"),
  ],
  meetup: [
    photo(8555602, "Collaborative business meeting"),
    photo(4872010, "Colleagues in a meeting room"),
    photo(4623507, "Professionals greeting at a meeting"),
    photo(7647988, "Interactive presentation"),
  ],
  art: [
    photo(11905911, "Visitors viewing framed paintings"),
    photo(26605630, "Gallery visitors exploring paintings"),
    photo(33714764, "People discussing gallery art"),
    photo(7763082, "Art exhibition with visitors"),
  ],
  food: [
    photo(4570082, "Indian street food stall"),
    photo(34943742, "Vendor preparing flatbreads"),
    photo(33472114, "Traditional Indian food preparation"),
    photo(30425147, "Colourful Indian food stall"),
  ],
  yoga: [
    photo(13849262, "Outdoor yoga at dawn"),
    photo(8018964, "Yoga beside water at sunrise"),
    photo(8018975, "Mindful yoga practice outdoors"),
    photo(32848109, "Yoga in a natural setting"),
  ],
  tech: [
    photo(38786014, "Conference audience"),
    photo(8761520, "Business conference presentation"),
    photo(7647988, "Speaker taking audience questions"),
    photo(6804071, "Software developers collaborating"),
  ],
  photography: [
    photo(29284333, "Photographer at a workshop"),
    photo(29436248, "Hands-on photography instruction"),
    photo(36232024, "Photographer with a camera outdoors"),
    photo(35818130, "Photographer composing an outdoor scene"),
  ],
  coding: [
    photo(4385446, "Programmers working on a laptop"),
    photo(6804071, "Collaborative software development"),
    photo(7988747, "Developers discussing code"),
    photo(12899191, "Software development discussion"),
  ],
  comedy: [
    photo(10063045, "Stand-up performance on stage"),
    photo(10078868, "Comedian holding a microphone"),
    photo(17509457, "Microphone on a stage"),
    photo(518389, "Audience facing a live stage"),
  ],
  festival: [
    photo(19130866, "Music festival audience"),
    photo(518389, "Live band on stage"),
    photo(894566, "Concert lights and cheering audience"),
    photo(19326947, "Audience photographing a music performance"),
  ],
};

// Locations are neighbourhood-level illustrations, never confirmed venue bookings.
const LISTINGS = [
  [
    "garba",
    "Garba & Dandiya: Colours of Ahmedabad",
    "Ahmedabad",
    "Gujarat",
    "Community & celebrations",
    "Navrangpura",
    23.036,
    72.561,
    19,
    4,
    300,
    [199, 399, 899],
    "Early Bird|General Admission|Premium Viewing",
    "Learn the circle steps, practise paired dandiya and celebrate Gujarati folk rhythms.",
    "Beginner circle practice|Dandiya partner rotation|Open dance circle",
    "Comfortable footwear; bring your own dandiya sticks. Children must attend with an adult.",
    "Water refill, rest area, first-aid point",
  ],
  [
    "music",
    "Unplugged Evenings: Bengaluru Indie Sessions",
    "Bengaluru",
    "Karnataka",
    "Music & nightlife",
    "Indiranagar",
    12.978,
    77.641,
    18,
    3,
    120,
    [299, 599, 999],
    "Early Bird|General Admission|Front Row",
    "An intimate acoustic listening format for original songs, stripped-back arrangements and conversation.",
    "Doors and listening etiquette|Acoustic sets|Audience conversation",
    "Ages 16+; no flash photography or disruptive recording.",
    "Seating, drinking water, accessible entry subject to venue confirmation",
  ],
  [
    "pottery",
    "Clay & Chai: Jaipur Pottery Studio",
    "Jaipur",
    "Rajasthan",
    "Workshops & classes",
    "C Scheme",
    26.911,
    75.803,
    10,
    3,
    36,
    [699, 999, 1499],
    "Student|Workshop Admission|Workshop Premium",
    "Explore clay preparation, hand-building and introductory wheel techniques in a small-group studio format.",
    "Clay and tool introduction|Guided making session|Finishing and care discussion",
    "Ages 14+; wear clothes that can get clay on them. Firing and collection are illustrative, not promised.",
    "Tools, apron, hand-wash station, tea",
  ],
  [
    "meetup",
    "Founders Table: Gurugram Startup Meetup",
    "Gurugram",
    "Haryana",
    "Meetups & networking",
    "Sector 29",
    28.469,
    77.062,
    16,
    3,
    90,
    [0, 299, 699],
    "Free RSVP|General Admission|Founder Roundtable",
    "A structured networking format for early-stage founders to exchange product lessons and meet potential collaborators.",
    "Introductions and problem statements|Peer feedback circles|Open networking",
    "No unsolicited sales pitches. Respect confidential conversations.",
    "Name badges, seating, water, networking prompts",
  ],
  [
    "art",
    "Slow Looking: Delhi Gallery Walk",
    "Delhi",
    "Delhi",
    "Arts & culture",
    "Mandi House",
    28.625,
    77.234,
    11,
    2,
    30,
    [0, 249, 499],
    "Free RSVP|Guided Walk|Student Study Pass",
    "Practise close observation and discussion through a sample contemporary-art walk, without claiming any gallery partnership.",
    "Looking exercises|Small-group art discussion|Reflection and sketch notes",
    "No touching artworks. Photography and accessibility depend on the actual gallery.",
    "Discussion notes, walking breaks, small groups",
  ],
  [
    "food",
    "Old City Flavours: Lucknow Heritage Food Walk",
    "Lucknow",
    "Uttar Pradesh",
    "Food & drink",
    "Chowk",
    26.86,
    80.913,
    17,
    3,
    42,
    [399, 799, 1199],
    "Walk Only|Tasting Pass|Extended Tasting",
    "Discover the storytelling format of a heritage food trail through old-city lanes and the traditions of Awadhi cooking.",
    "Food history introduction|Illustrative tasting stops|Market walk and discussion",
    "Tell the organizer about allergies. Food safety, menus and vendors are not confirmed by this sample listing.",
    "Walking route, rest breaks, vegetarian options on request",
  ],
  [
    "yoga",
    "First Light: Rishikesh Sunrise Yoga",
    "Rishikesh",
    "Uttarakhand",
    "Sports & wellness",
    "Tapovan",
    30.13,
    78.324,
    6,
    2,
    48,
    [0, 399, 899],
    "Free Community RSVP|Guided Practice|Small Group Practice",
    "A gentle sunrise practice format combining breath awareness, mobility and a quiet closing meditation.",
    "Grounding and breathwork|Gentle movement|Rest and reflection",
    "Not medical treatment; practise within your comfort. Bring a mat and water; do not enter the river.",
    "Rest breaks, beginner modifications, outdoor practice",
  ],
  [
    "tech",
    "Applied AI: Hyderabad Technology Summit",
    "Hyderabad",
    "Telangana",
    "Conferences",
    "HITEC City",
    17.448,
    78.379,
    9,
    8,
    240,
    [799, 1499, 2999],
    "Student|General Admission|Summit Premium",
    "A sample summit programme exploring practical AI products, evaluation, responsible deployment and engineering trade-offs.",
    "Product case studies|Engineering sessions and lunch break|Evaluation clinic and networking",
    "No speakers or sponsors are confirmed. Do not share production credentials in demonstrations.",
    "Session seating, charging points, networking space",
  ],
  [
    "photography",
    "Frame the Morning: Udaipur Photography Walk",
    "Udaipur",
    "Rajasthan",
    "Workshops & classes",
    "Ambrai neighbourhood",
    24.576,
    73.678,
    7,
    3,
    24,
    [499, 899, 1499],
    "Student|Photo Walk|Portfolio Feedback",
    "Practise light, composition and visual storytelling on a neighbourhood walk with an optional critique format.",
    "Camera and phone setup|Composition exercises|Peer image review",
    "Ask before photographing people. No drones or restricted-area entry; bring your own camera or phone.",
    "Route notes, rest stops, small-group feedback",
  ],
  [
    "coding",
    "Build with AI: Pune Coding Workshop",
    "Pune",
    "Maharashtra",
    "Workshops & classes",
    "Baner",
    18.559,
    73.786,
    10,
    6,
    60,
    [499, 1299, 2499],
    "Student|Workshop Admission|Workshop Premium",
    "Work through a small AI application, from a local development environment to evaluation and a responsible deployment checklist.",
    "Environment setup|Guided build and break|Evaluation and code review",
    "Bring a laptop. Use sandbox credentials only; paid third-party API usage is not included.",
    "Wi-Fi subject to confirmation, charging points, exercise notes",
  ],
  [
    "comedy",
    "After Hours: Noida Stand-up Night",
    "Noida",
    "Uttar Pradesh",
    "Arts & culture",
    "Sector 18",
    28.57,
    77.322,
    19,
    2,
    96,
    [199, 399, 699],
    "Early Bird|General Admission|Front Row",
    "A sample live-comedy format with short sets, audience etiquette and a relaxed interval. No performer lineup is confirmed.",
    "Doors and seating|Stand-up sets|Closing session",
    "Ages 18+; no recording, heckling or disruptive phone use.",
    "Seating, drinking water, interval",
  ],
  [
    "festival",
    "Campus Frequencies: Greater Noida Music Festival",
    "Greater Noida",
    "Uttar Pradesh",
    "Music & nightlife",
    "Knowledge Park II",
    28.462,
    77.505,
    15,
    7,
    420,
    [299, 699, 1499],
    "Student|General Admission|Festival Premium",
    "A sample college-festival programme with independent music, student creativity and community gathering. No college or artist partnership is implied.",
    "Campus showcase format|Live music sessions|Evening finale",
    "Ages 16+; student passes require valid ID in a real event. No alcohol, unsafe behaviour or prohibited items.",
    "Water refill, rest areas, first-aid point, food area subject to confirmation",
  ],
];

function id(key) {
  const hex = createHash("sha256").update(`${MARKER}:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function options(env = process.env, args = process.argv.slice(2)) {
  const allowed = [
    "--apply",
    "--dry-run",
    "--cleanup",
    "--verify",
    "--validate",
    "--publish",
    "--check-images",
  ];
  for (const arg of args)
    if (!allowed.includes(arg)) throw Error(`Unknown option: ${arg}`);
  if (args.includes("--apply") && args.includes("--dry-run"))
    throw Error("Choose --apply or --dry-run.");
  if (args.includes("--cleanup") && args.includes("--publish"))
    throw Error("Cleanup cannot publish.");
  if (
    args.includes("--verify") &&
    (args.includes("--cleanup") || args.includes("--apply"))
  )
    throw Error("Verification is read-only.");
  const emails = [
    ...new Set(
      (env.SEED_ORGANIZER_EMAILS || DEFAULT_EMAILS.join(","))
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (
    !emails.length ||
    emails.some((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
  )
    throw Error("Provide valid organizer emails.");
  const start =
    env.SEED_START_DATE ||
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !Number.isFinite(Date.parse(start)) ||
    new Date(start).toISOString().slice(0, 10) !== start
  )
    throw Error("SEED_START_DATE must be a valid YYYY-MM-DD date.");
  let cdn;
  if (env.SEED_IMAGE_CDN_BASE) {
    cdn = new URL(env.SEED_IMAGE_CDN_BASE);
    if (
      cdn.protocol !== "https:" ||
      cdn.username ||
      cdn.password ||
      cdn.search ||
      cdn.hash
    )
      throw Error(
        "Use an HTTPS CDN base without credentials, query or fragment.",
      );
  }
  const orgIds = JSON.parse(env.SEED_ORG_IDS || "{}");
  if (!orgIds || typeof orgIds !== "object" || Array.isArray(orgIds))
    throw Error("SEED_ORG_IDS must be an email-to-workspace-ID JSON object.");
  return {
    emails,
    start,
    cdn: cdn?.href.replace(/\/$/, ""),
    orgIds,
    apply: args.includes("--apply"),
    cleanup: args.includes("--cleanup"),
    verify: args.includes("--verify"),
    validate: args.includes("--validate"),
    publish: args.includes("--publish"),
    checkImages: args.includes("--check-images"),
  };
}
function assertSafety(config, env) {
  const database = new URL(
    env.DATABASE_URL || "postgresql://localhost/missing",
  );
  const app = new URL(env.APP_URL || "http://localhost:3000");
  const local = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
  const production =
    env.NODE_ENV === "production" ||
    !local(database.hostname) ||
    !local(app.hostname);
  if (
    config.publish &&
    (production ||
      env.CASHFREE_ENV !== "sandbox" ||
      env.SEED_ALLOW_PUBLISH !== "true")
  )
    throw Error(
      "Publishing demos requires local database/app, non-production NODE_ENV, CASHFREE_ENV=sandbox and SEED_ALLOW_PUBLISH=true. Production seeds must remain drafts.",
    );
  if (config.apply && production && env.SEED_ALLOW_PRODUCTION_DRAFTS !== "true")
    throw Error(
      "Remote/production writes require SEED_ALLOW_PRODUCTION_DRAFTS=true; only demo drafts or guarded cleanup are allowed.",
    );
}
function buildEvents(config, now = new Date()) {
  return LISTINGS.map((row, index) => {
    const [
      key,
      title,
      city,
      state,
      category,
      area,
      lat,
      lng,
      hour,
      duration,
      capacity,
      prices,
      tierNames,
      concept,
      agenda,
      rules,
      amenities,
    ] = row;
    const day = new Date(`${config.start}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + index * 3);
    const startsAt = new Date(
      `${day.toISOString().slice(0, 10)}T${String(hour).padStart(2, "0")}:00:00+05:30`,
    );
    if (startsAt <= now && !config.cleanup && !config.verify)
      throw Error("Seed dates must be in the future; set SEED_START_DATE.");
    const slug = `${PREFIX}${key}`;
    const images = PHOTOS[key].map((p, order) => {
      const url = (size) =>
        config.cdn
          ? `${config.cdn}/${key}/${order + 1}.jpg`
          : p.url ||
            `https://images.pexels.com/photos/${p.id}/pexels-photo-${p.id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=${size}&h=${Math.round((size * 9) / 16)}`;
      return {
        id: id(`${key}:image:${order}`),
        kind: order ? "GALLERY" : "POSTER",
        storageKey: `seed/${MARKER}/${key}/${order + 1}.jpg`,
        variants: Object.fromEntries(
          [
            ["thumb", 320],
            ["card", 640],
            ["hero", 1280],
            ["og", 1200],
          ].map(([name, size]) => [name, { jpeg: url(size) }]),
        ),
        alt: `Illustrative photo: ${p.alt}. Not a confirmed venue or performer.`,
        mime: "image/jpeg",
        sizeBytes: 0,
        sortOrder: order,
        source: p,
      };
    });
    const names = tierNames.split("|");
    const ticketTypes = prices.map((rupees, order) => ({
      id: id(`${key}:ticket:${order}`),
      name: names[order],
      description:
        "DEMO / SANDBOX ONLY. Admits one person; no real attendance entitlement.",
      pricePaise: rupees * 100,
      quantityTotal:
        Math.floor(capacity / prices.length) +
        (order === 0 ? capacity % prices.length : 0),
      saleStartsAt: now,
      saleEndsAt: startsAt,
      minPerOrder: 1,
      maxPerOrder: 5,
      isHidden: false,
      sortOrder: order,
    }));
    const credits = images
      .map(
        ({ source: p }) =>
          `- [${p.alt}](${p.source})${p.credit ? ` — ${p.credit}` : ""}; [license](${p.license}). Illustrative photograph, resized for display${p.url ? "; no content changes" : " and cropped"}.`,
      )
      .join("\n");
    return {
      id: id(key),
      slug,
      title: `[DEMO] ${title}`,
      summary: `Demo listing only — ${concept}`,
      description: `${MARKER}\n\n**DEMO EVENT — fictional sample. Do not travel to this location or make a real payment. No venue, performer, speaker, sponsor or institution is confirmed. Photos illustrate the activity, not this event.**\n\n## The experience\n${concept} This sample shows how an organizer can present an event on Raunak.\n\n## Location\n${area}, ${city}, ${state}, India. The pin is approximate; this is not a booked venue.\n\n## Agenda (illustrative)\n${agenda
        .split("|")
        .map((item, i) => `${i + 1}. ${item}`)
        .join(
          "\n",
        )}\n\n## Rules\n${rules}\nRespect other attendees and follow staff guidance in any real event.\n\n## Amenities (illustrative)\n${amenities}. Confirm accessibility with the organizer before any real booking.\n\n## Booking instructions\nSandbox only. Choose a tier and quantity, sign in, enter valid contact details and review the backend-calculated total. Each ticket admits one person. Free RSVP skips Cashfree; paid tickets use Cashfree sandbox. Test confirmations are not valid admission.\n\n## FAQs\n**Is this a real event?** No, it is a clearly labelled product demonstration.\n**Are the venue and lineup confirmed?** No.\n**Can I attend or pay real money?** No. Sandbox bookings only.\n\n## Tags\ndemo, ${key}, ${city.toLowerCase()}, ${category.toLowerCase()}\n\n## Photo credits\n${credits}`,
      category,
      city,
      venueName: `Demo venue — ${area} (not confirmed)`,
      address: `${area}, ${city}, ${state}, India (approximate demo location)`,
      lat,
      lng,
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      mode: "IN_PERSON",
      timezone: "Asia/Kolkata",
      visibility: "PUBLIC",
      status: config.publish ? "PUBLISHED" : "DRAFT",
      isTest: !config.publish,
      publishedAt: config.publish ? now : null,
      startsAt,
      endsAt: new Date(startsAt.getTime() + duration * 3600000),
      capacity,
      refundPolicy:
        "Demo only: no real payment or attendance entitlement. Sandbox refunds follow the existing test-payment flow. For a real event, replace this sample policy before selling tickets.",
      organizerEmail: config.emails[index % config.emails.length],
      images,
      ticketTypes,
    };
  });
}

async function checkImages(events) {
  const urls = [
    ...new Set(
      events.flatMap((e) => e.images.map((i) => i.variants.card.jpeg)),
    ),
  ];
  for (let i = 0; i < urls.length; i += 4)
    await Promise.all(
      urls.slice(i, i + 4).map(async (url) => {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(20000),
        });
        const valid =
          response.ok &&
          /^image\//.test(response.headers.get("content-type") || "");
        await response.body?.cancel();
        if (!valid)
          throw Error(
            `Image unavailable: ${url} (${response.status}). Supply SEED_IMAGE_CDN_BASE with licensed assets.`,
          );
      }),
    );
  return urls.length;
}
async function resolveOrganizers(client, config) {
  const result = new Map();
  for (const email of config.emails) {
    const users = (
      await client.query(
        'SELECT id, "firebaseUid" FROM "User" WHERE lower(email) = $1',
        [email],
      )
    ).rows;
    if (
      users.length !== 1 ||
      !users[0].firebaseUid ||
      users[0].firebaseUid.startsWith("seed-")
    )
      throw Error(
        `Existing authenticated user required: ${email}. Sign in to Raunak first; this script never creates users.`,
      );
    const orgs = (
      await client.query(
        'SELECT o.id FROM "Organization" o JOIN "OrganizationMember" m ON m."orgId"=o.id WHERE m."userId"=$1 AND m.role=\'OWNER\' AND m.status=\'ACTIVE\' AND o.status=\'ACTIVE\' ORDER BY o.id',
        [users[0].id],
      )
    ).rows;
    const selected = config.orgIds[email]
      ? orgs.find((o) => o.id === config.orgIds[email])
      : orgs.length === 1
        ? orgs[0]
        : null;
    if (!selected)
      throw Error(
        `Select an existing owned workspace for ${email} using SEED_ORG_IDS (found ${orgs.length}). Create the workspace through Raunak if necessary.`,
      );
    result.set(email, { orgId: selected.id, userId: users[0].id });
  }
  return result;
}
async function insert(client, table, record) {
  // Table and column names are internal constants; all data uses SQL parameters.
  const entries = Object.entries(record);
  await client.query(
    `INSERT INTO "${table}" (${entries.map(([k]) => `"${k}"`).join(",")}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(",")})`,
    entries.map(([, value]) => value),
  );
}
async function existingSeed(client, events, owners) {
  const rows = (
    await client.query(
      'SELECT id, slug, "orgId", description FROM "Event" WHERE id = ANY($1::uuid[]) OR slug = ANY($2::text[]) FOR UPDATE',
      [events.map((e) => e.id), events.map((e) => e.slug)],
    )
  ).rows;
  for (const row of rows) {
    const planned = events.find((e) => e.id === row.id);
    if (
      !planned ||
      row.slug !== planned.slug ||
      row.orgId !== owners.get(planned.organizerEmail).orgId ||
      !row.description?.startsWith(MARKER)
    )
      throw Error(
        "Seed ID/slug collision or ownership changed. No data modified.",
      );
  }
  return rows;
}
async function verify(client, events, owners) {
  const rows = (
    await client.query(
      'SELECT e.id, e.slug, e.title, e."orgId", e.description, e.status, e."isTest", e.capacity, (SELECT count(*)::int FROM "EventImage" i WHERE i."eventId"=e.id) AS images, (SELECT count(*)::int FROM "TicketType" t WHERE t."eventId"=e.id) AS tiers, (SELECT coalesce(sum("quantityTotal"),0)::int FROM "TicketType" t WHERE t."eventId"=e.id) AS inventory FROM "Event" e WHERE e.id = ANY($1::uuid[])',
      [events.map((e) => e.id)],
    )
  ).rows;
  if (rows.length !== events.length)
    throw Error(
      `Verification found ${rows.length}/${events.length} demo events.`,
    );
  for (const row of rows) {
    const e = events.find((event) => event.id === row.id);
    if (
      row.slug !== e.slug ||
      row.orgId !== owners.get(e.organizerEmail).orgId ||
      !row.title.startsWith("[DEMO]") ||
      !row.description?.startsWith(MARKER) ||
      row.images !== 4 ||
      row.tiers !== 3 ||
      row.inventory > row.capacity
    )
      throw Error(
        `Verification failed: ${e.slug}. Existing records are never overwritten; inspect manually.`,
      );
  }
  return rows;
}
async function run(config, env = process.env, log = console.log) {
  const events = buildEvents(config);
  assertSafety(config, env);
  log(
    `Plan: ${events.length} demo events, ${events.length * 3} INR ticket tiers, ${events.length * 4} images. ${config.publish ? "SANDBOX PUBLIC" : "DRAFT / excluded from public discovery"}.`,
  );
  if (config.validate) {
    if (config.checkImages)
      log(`Verified ${await checkImages(events)} image URLs.`);
    log("Dataset valid. No database connection or writes.");
    return events;
  }
  if (!env.DATABASE_URL) throw Error("DATABASE_URL is required.");
  if (config.checkImages || (config.apply && !config.cleanup))
    log(`Verified ${await checkImages(events)} image URLs.`);
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SELECT pg_advisory_xact_lock(71941023)");
    // These projections fail before writes if the installed schema is incompatible.
    await client.query('SELECT "firebaseUid" FROM "User" LIMIT 0');
    await client.query(
      'SELECT "isTest", "documents", "lat", "lng" FROM "Event" LIMIT 0',
    );
    await client.query(
      'SELECT "variants", "alt", "sortOrder" FROM "EventImage" LIMIT 0',
    );
    await client.query(
      'SELECT "pricePaise", "quantityHeld", "quantitySold" FROM "TicketType" LIMIT 0',
    );
    const owners = await resolveOrganizers(client, config);
    const existing = await existingSeed(client, events, owners);
    if (config.verify) {
      const rows = await verify(client, events, owners);
      log(
        `Verified ${rows.length} events, 48 images, 36 tiers and existing workspace ownership.`,
      );
    } else if (config.cleanup) {
      const ids = existing.map((e) => e.id);
      const orders = await client.query(
        'SELECT id FROM "Order" WHERE "eventId"=ANY($1::uuid[]) LIMIT 1',
        [ids],
      );
      const tickets = await client.query(
        'SELECT id FROM "Ticket" WHERE "eventId"=ANY($1::uuid[]) LIMIT 1',
        [ids],
      );
      if (orders.rowCount || tickets.rowCount)
        throw Error(
          "Cleanup refused: demo events have bookings/tickets. Preserve payment/admission history; archive them through the app instead.",
        );
      log(
        `${config.apply ? "Deleting" : "Would delete"} ${ids.length} recognized demo events and their image/ticket-type rows. Users/workspaces retained.`,
      );
      if (config.apply) {
        await client.query(
          'DELETE FROM "TicketType" WHERE "eventId"=ANY($1::uuid[])',
          [ids],
        );
        await client.query('DELETE FROM "Event" WHERE id=ANY($1::uuid[])', [
          ids,
        ]);
      }
    } else {
      for (const event of events) {
        const { organizerEmail, images, ticketTypes, ...record } = event;
        const owner = owners.get(organizerEmail);
        const exists = existing.some((e) => e.id === event.id);
        log(
          `${exists ? "KEEP" : config.apply ? "CREATE" : "WOULD CREATE"} ${event.slug} → ${organizerEmail} / workspace ${owner.orgId}`,
        );
        if (!exists && config.apply) {
          await insert(client, "Event", {
            ...record,
            orgId: owner.orgId,
            updatedAt: new Date(),
          });
          for (const image of images) {
            const record = { ...image };
            delete record.source;
            await insert(client, "EventImage", {
              ...record,
              eventId: event.id,
              updatedAt: new Date(),
            });
          }
          for (const type of ticketTypes)
            await insert(client, "TicketType", {
              ...type,
              eventId: event.id,
              updatedAt: new Date(),
            });
        }
      }
      if (config.apply) await verify(client, events, owners);
    }
    await client.query(config.apply ? "COMMIT" : "ROLLBACK");
    log(
      config.apply
        ? "Committed and verified. No users, bookings, payments or settlements created."
        : "Read-only run complete; no writes committed.",
    );
    return events;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}
module.exports = {
  MARKER,
  PREFIX,
  id,
  options,
  assertSafety,
  buildEvents,
  checkImages,
  resolveOrganizers,
  run,
};
if (require.main === module) {
  require("dotenv/config");
  Promise.resolve()
    .then(() => run(options()))
    .catch((error) => {
      // Avoid dumping connection strings, provider credentials or SQL parameter data.
      console.error(
        `Seed failed: ${error.code ? `database error ${error.code}; transaction rolled back` : error.message}`,
      );
      process.exitCode = 1;
    });
}
