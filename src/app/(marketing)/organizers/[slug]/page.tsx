import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { currentUser } from "@/server/auth/session";
import { discoverPage, publicListing } from "@/server/public/events";
import { EventCard } from "@/components/public/event-card";
import { FollowOrganizerButton } from "@/components/public/follow-organizer-button";
import { OrganizerEventsSection } from "@/components/public/organizer-events-section";
import { MarketingFooter } from "@/components/marketing/footer";
import {
  Star,
  CalendarDays,
  Users,
  Mail,
  Phone,
  Globe,
  BadgeCheck,
  ExternalLink,
  Heart,
} from "lucide-react";
import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";
import { organizerCoverUrl, organizerLogoUrl } from "@/lib/organizer-images";
import "./organizer-profile.css";

type SocialLinks = {
  instagram?: string;
  twitter?: string;
  youtube?: string;
  website?: string;
  linkedin?: string;
};

type HighlightItem = {
  id: string;
  url: string;
  caption?: string;
};

const base = process.env.APP_URL || "http://localhost:3000";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const org = await db.organization.findFirst({
    where: { slug, status: "ACTIVE" },
    select: { name: true, tagline: true, slug: true },
  });
  if (!org) return { title: "Organizer not found" };
  const description =
    org.tagline || `Explore events by ${org.name} on ${APP_NAME}.`;
  return {
    title: `${org.name} | ${APP_NAME}`,
    description,
    alternates: { canonical: `${base}/organizers/${org.slug}` },
    openGraph: {
      type: "website",
      title: org.name,
      description,
      url: `${base}/organizers/${org.slug}`,
    },
  };
}

export default async function OrganizerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await db.organization.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      slug: true,
      logoKey: true,
      tagline: true,
      bio: true,
      socialLinks: true,
      coverKey: true,
      coverPosition: true,
      highlights: true,
      profileVisible: true,
      brandColor: true,
      supportEmail: true,
      supportPhone: true,
    },
  });
  if (!org || !org.profileVisible) notFound();

  // Check if org has at least one public event (otherwise hide profile for pure-private orgs)
  const hasPublicEvents = Boolean(
    await db.event.findFirst({
      where: {
        orgId: org.id,
        ...publicListing,
        status: { in: ["PUBLISHED", "ENDED"] },
      },
      select: { id: true },
    }),
  );
  if (!hasPublicEvents) notFound();

  const [upcomingResult, pastEvents, reviewSummary, topReviews, totalAttendees, user, followerCount] =
    await Promise.all([
      discoverPage({ organizer: slug }),
      db.event.findMany({
        where: {
          orgId: org.id,
          status: { in: ["PUBLISHED", "ENDED"] },
          endsAt: { lte: new Date() },
          visibility: "PUBLIC",
          deletedAt: null,
          isTest: false,
        },
        orderBy: { startsAt: "desc" },
        take: 6,
        include: {
          images: { where: { kind: "POSTER" }, take: 1 },
          ticketTypes: { where: { isHidden: false }, select: { pricePaise: true } },
          org: { select: { id: true, name: true, slug: true, logoKey: true } },
        },
      }),
      db.eventReview.aggregate({
        where: {
          event: {
            orgId: org.id,
            status: { in: ["PUBLISHED", "ENDED"] },
            visibility: "PUBLIC",
            deletedAt: null,
            isTest: false,
            org: { status: "ACTIVE" },
          },
        },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      db.eventReview.findMany({
        where: {
          body: { not: null },
          event: {
            orgId: org.id,
            status: { in: ["PUBLISHED", "ENDED"] },
            visibility: "PUBLIC",
            deletedAt: null,
            isTest: false,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          user: { select: { name: true } },
          event: { select: { title: true } },
        },
      }),
      db.ticket.count({
        where: {
          event: {
            orgId: org.id,
            deletedAt: null,
            isTest: false,
          },
          order: { status: "PAID" },
        },
      }),
      currentUser(),
      db.organizationFollower.count({ where: { orgId: org.id } }),
    ]);

  const [saved, isFollowing] = await Promise.all([
    user
      ? db.savedEvent.findMany({
          where: {
            userId: user.id,
            eventId: {
              in: upcomingResult.events.map((event) => event.id),
            },
          },
          select: { eventId: true },
        })
      : [],
    user
      ? Boolean(
          await db.organizationFollower.findUnique({
            where: { userId_orgId: { userId: user.id, orgId: org.id } },
          }),
        )
      : false,
  ]);

  const highlights = (Array.isArray(org.highlights)
    ? org.highlights
    : []) as HighlightItem[];

  const totalEventsHosted = await db.event.count({
    where: {
      orgId: org.id,
      status: { in: ["PUBLISHED", "ENDED"] },
      visibility: "PUBLIC",
      deletedAt: null,
      isTest: false,
    },
  });

  // Check if the current user is an admin of this org
  const isAdmin = user
    ? Boolean(
        await db.organizationMember.findFirst({
          where: {
            orgId: org.id,
            userId: user.id,
            role: { in: ["OWNER", "ADMIN"] },
            status: "ACTIVE",
          },
        }),
      )
    : false;

  const socials = (org.socialLinks || {}) as SocialLinks;
  const hasSocials = Object.values(socials).some((v) => v && v.trim());

  return (
    <>
      <main className="org-profile">
        {/* Hero Banner */}
        <section className="org-hero">
          {organizerCoverUrl(org.id, org.coverKey) ? (
            <img
              src={organizerCoverUrl(org.id, org.coverKey)!}
              alt={`${org.name} cover`}
              className="org-hero-cover"
              style={{ objectPosition: org.coverPosition || "center" }}
            />
          ) : (
            <div
              className="org-hero-gradient"
              style={
                org.brandColor &&
                !org.brandColor.toLowerCase().includes("4f46e5")
                  ? {
                      background: `linear-gradient(135deg, ${org.brandColor} 0%, var(--art-poster-dark) 100%)`,
                    }
                  : undefined
              }
            />
          )}
          <div className="org-hero-scrim" />
          <div className="org-hero-content">
            {organizerLogoUrl(org.id, org.logoKey) ? (
              <img
                src={organizerLogoUrl(org.id, org.logoKey)!}
                alt={`${org.name} logo`}
                className="org-hero-logo"
              />
            ) : (
              <span className="org-hero-logo-fallback" aria-hidden="true">
                {org.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="org-hero-text">
              <h1>{org.name}</h1>
              {org.tagline && <p>{org.tagline}</p>}
            </div>
            <div className="org-hero-actions">
              <FollowOrganizerButton
                orgId={org.id}
                initialFollowersCount={followerCount}
                initialIsFollowing={isFollowing}
              />
            </div>
          </div>
        </section>

        {/* Admin edit banner */}
        {isAdmin && (
          <div className="org-edit-banner">
            <span>This is your public organizer profile.</span>
            <Link href={`/dashboard/settings/profile?org=${org.id}`}>
              Edit profile →
            </Link>
          </div>
        )}

        {/* Stats Row */}
        <div className="org-stats">
          <div className="org-stat">
            <CalendarDays size={18} className="org-stat-icon" aria-hidden="true" />
            <strong>{totalEventsHosted}</strong>
            <span>{totalEventsHosted === 1 ? "event" : "events"} hosted</span>
          </div>
          <div className="org-stat">
            <Users size={18} className="org-stat-icon" aria-hidden="true" />
            <strong>{followerCount.toLocaleString("en-IN")}</strong>
            <span>{followerCount === 1 ? "follower" : "followers"}</span>
          </div>
          {reviewSummary._count._all > 0 &&
            reviewSummary._avg.rating !== null && (
              <div className="org-stat">
                <Star
                  size={18}
                  fill="currentColor"
                  className="org-stat-icon"
                  aria-hidden="true"
                />
                <strong>{reviewSummary._avg.rating.toFixed(1)}</strong>
                <span>
                  from {reviewSummary._count._all}{" "}
                  {reviewSummary._count._all === 1 ? "review" : "reviews"}
                </span>
              </div>
            )}
          {totalAttendees > 0 && (
            <div className="org-stat">
              <Users size={18} className="org-stat-icon" aria-hidden="true" />
              <strong>{totalAttendees.toLocaleString("en-IN")}</strong>
              <span>attendees served</span>
            </div>
          )}
        </div>

        {/* About Section */}
        {org.bio ? (
          <section className="org-about">
            <p className="org-about-label">ABOUT US</p>
            <h2>
              Who we are and why we <em className="m-serif">gather.</em>
            </h2>
            <p className="org-about-body">{org.bio}</p>
          </section>
        ) : isAdmin ? (
          <section className="org-about">
            <p className="org-about-label">ABOUT US</p>
            <div className="org-empty-bio">
              Add a bio to tell attendees about your community.{" "}
              <Link
                href={`/dashboard/settings/profile?org=${org.id}`}
                style={{ color: "var(--accent)", fontWeight: 600 }}
              >
                Edit profile →
              </Link>
            </div>
          </section>
        ) : null}

        {/* Social Links */}
        {hasSocials && (
          <div className="org-socials">
            {socials.website && (
              <a
                href={socials.website}
                className="org-social-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe size={15} aria-hidden="true" />
                Website
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
            {socials.instagram && (
              <a
                href={socials.instagram}
                className="org-social-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
            {socials.twitter && (
              <a
                href={socials.twitter}
                className="org-social-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                X / Twitter
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
            {socials.youtube && (
              <a
                href={socials.youtube}
                className="org-social-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                YouTube
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
            {socials.linkedin && (
              <a
                href={socials.linkedin}
                className="org-social-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                LinkedIn
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
          </div>
        )}

        {/* Events with tabs */}
        <OrganizerEventsSection
          upcomingEvents={upcomingResult.events}
          pastEvents={pastEvents}
          savedEventIds={saved.map((item) => item.eventId)}
          organizerSlug={org.slug}
        />

        {/* Event Highlights Photo Gallery */}
        {highlights.length > 0 && (
          <section className="org-highlights-section" id="highlights">
            <div className="org-highlights-header">
              <p className="org-about-label">EVENT HIGHLIGHTS</p>
              <h2>Moments from previous gatherings</h2>
            </div>
            <div className="org-highlights-grid">
              {highlights.map((hl) => (
                <figure key={hl.id} className="org-highlight-item">
                  <img src={hl.url} alt={hl.caption || "Event moment"} loading="lazy" />
                  {hl.caption && <figcaption>{hl.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* Attendee Reviews */}
        {topReviews.length > 0 && (
          <section className="org-reviews-section">
            <div className="org-reviews-header">
              <h2>What attendees say</h2>
              {reviewSummary._avg.rating !== null && (
                <div className="org-reviews-summary">
                  <Star
                    size={16}
                    fill="currentColor"
                    className="org-stat-icon"
                    aria-hidden="true"
                  />
                  <strong>{reviewSummary._avg.rating.toFixed(1)}</strong>
                  <span style={{ color: "var(--muted)" }}>
                    · {reviewSummary._count._all}{" "}
                    {reviewSummary._count._all === 1 ? "review" : "reviews"}
                  </span>
                </div>
              )}
            </div>
            <div>
              {topReviews.map((review) => (
                <div className="org-review-card" key={review.id}>
                  <div className="org-review-meta">
                    <strong>{review.user.name || "Attendee"}</strong>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        color: "var(--muted)",
                      }}
                    >
                      <BadgeCheck size={13} aria-hidden="true" /> Verified
                    </span>
                    <span style={{ color: "var(--muted)" }}>
                      on {review.event.title}
                    </span>
                  </div>
                  <p className="org-review-stars" aria-label={`${review.rating} out of 5`}>
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </p>
                  {review.body && (
                    <p className="org-review-body">{review.body}</p>
                  )}
                  {(review.firstTimerFriendly === true ||
                    review.easyToReach === true) && (
                    <div className="org-review-badges">
                      {review.firstTimerFriendly === true && (
                        <span className="org-review-badge">
                          Good for first-timers
                        </span>
                      )}
                      {review.easyToReach === true && (
                        <span className="org-review-badge">Easy to reach</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Contact Section */}
        {(org.supportEmail || org.supportPhone) && (
          <section className="org-contact">
            <h2>Get in touch</h2>
            <div className="org-contact-items">
              {org.supportEmail && (
                <a
                  href={`mailto:${org.supportEmail}`}
                  className="org-contact-item"
                >
                  <Mail size={16} aria-hidden="true" />
                  {org.supportEmail}
                </a>
              )}
              {org.supportPhone && (
                <a
                  href={`tel:${org.supportPhone}`}
                  className="org-contact-item"
                >
                  <Phone size={16} aria-hidden="true" />
                  {org.supportPhone}
                </a>
              )}
            </div>
          </section>
        )}

        {/* No upcoming events fallback */}
        {upcomingResult.events.length === 0 && (
          <section className="org-events-section">
            <div className="org-events-header">
              <h2>Upcoming events</h2>
            </div>
            <div className="org-empty-bio">
              No upcoming events right now. Check back soon or follow on social
              media for updates.
            </div>
          </section>
        )}
      </main>
      <MarketingFooter />
    </>
  );
}
