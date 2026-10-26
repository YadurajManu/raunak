import Link from "next/link";
import { unstable_cache } from "next/cache";
import { BrandMark } from "@/components/brand-mark";
import { APP_NAME } from "@/lib/constants";
import { marketing } from "@/config/marketing";
import { footerConfig, footerVariantForPath, type FooterAudience } from "@/config/footer";
import { site } from "@/config/site";
import { firstEventLabel } from "@/config/pricing";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { FooterControls, ThemeToggle } from "@/components/marketing/footer-controls";
import { BriefcaseBusiness, Camera, LockKeyhole, Mail, MessageCircle, QrCode, Share2 } from "lucide-react";

export { ThemeToggle };

type FooterLink = { label: string; href: string };
const exploreLinks = unstable_cache(async () => {
  const where = { status: "PUBLISHED" as const, visibility: "PUBLIC" as const, deletedAt: null, isTest: false, startsAt: { gte: new Date() }, org: { status: "ACTIVE" as const } };
  const [cities, categories] = await Promise.all([
    db.event.groupBy({ by: ["city"], where: { ...where, city: { not: null } }, _count: { city: true }, orderBy: { _count: { city: "desc" } }, take: 5 }),
    db.event.groupBy({ by: ["category"], where: { ...where, category: { not: null } }, _count: { category: true }, orderBy: { _count: { category: "desc" } }, take: 5 }),
  ]);
  return {
    cities: cities.flatMap((row) => row.city?.trim() ? [{ label: row.city.trim(), href: `/discover?${new URLSearchParams({ city: row.city.trim() })}` }] : []),
    categories: categories.flatMap((row) => row.category?.trim() ? [{ label: row.category.trim(), href: `/discover?${new URLSearchParams({ category: row.category.trim() })}` }] : []),
  };
}, ["footer-explore-links"], { revalidate: 3600 });

export async function MarketingFooter({ variant = "full" }: { variant?: "full" | "landing" }) {
  const [user, explore] = await Promise.all([currentUser(), exploreLinks().catch(() => ({ cities: [], categories: [] }))]);
  const memberships = user ? await db.organizationMember.findMany({ where: { userId: user.id, status: "ACTIVE", org: { status: "ACTIVE" } }, select: { role: true, orgId: true }, orderBy: { createdAt: "asc" } }) : [];
  const hasCheckin = user && !memberships.some((m) => ["OWNER", "ADMIN", "MANAGER", "FINANCE"].includes(m.role)) ? Boolean(await db.eventStaff.findFirst({ where: { userId: user.id, role: "CHECKIN", event: { status: "PUBLISHED", deletedAt: null } }, select: { eventId: true } })) : false;
  const audience: FooterAudience = memberships.some((m) => ["OWNER", "ADMIN", "MANAGER", "FINANCE"].includes(m.role)) ? "organizer" : hasCheckin ? "staff" : user ? "attendee" : "anon";
  const groups = footerConfig.groups.map((group) => ({ title: group.title, links: group.links.filter((link) => (link.visibleTo as readonly string[]).includes(audience)) as FooterLink[] }));
  groups[0].links.push(...explore.cities, ...explore.categories);
  if (audience === "anon") groups[2].links = groups[2].links.map((link) => link.label === "Host an event" ? { ...link, href: marketing.primaryCta.href } : link);
  if (audience === "anon") groups[1].links.push({ label: "Log in", href: "/login" });
  const organizer = audience === "organizer";
  const creatorOrgId = memberships.find((membership) => ["OWNER", "ADMIN", "MANAGER"].includes(membership.role))?.orgId;
  const hostHref = creatorOrgId ? `/dashboard/events/new?org=${encodeURIComponent(creatorOrgId)}` : "/dashboard";
  if (creatorOrgId) groups[2].links = groups[2].links.map((link) => link.label === "Create event" ? { ...link, href: hostHref } : link);
  if (organizer && !creatorOrgId) groups[2].links = groups[2].links.filter((link) => link.label !== "Create event");
  const socials = (Object.entries(site.socials) as [keyof typeof site.socials, string | null][]).filter((entry): entry is [keyof typeof site.socials, string] => Boolean(entry[1]));
  return <footer className={`m-footer${variant === "landing" ? " m-footer-landing" : ""}`}>
    <div className="m-footer-stub" aria-hidden="true"><span /></div>
    <div className="m-container">
      <div className="m-footer-top">
        <section className="m-footer-brand" aria-label="About Raunak">
          <Link href="/" className="m-footer-logo" aria-label="Raunak home"><BrandMark className="m-footer-mark" /><span>{APP_NAME}</span></Link>
          <p>{marketing.hero.headline}</p>
          <div className="m-footer-cta"><Link href="/discover" className="m-footer-button secondary">Discover events</Link><Link href={creatorOrgId ? hostHref : audience === "anon" ? marketing.primaryCta.href : "/dashboard"} className="m-footer-button accent">{creatorOrgId ? "Create event" : audience === "organizer" ? "Organizer dashboard" : "Host an event"}</Link></div>
          <small>{firstEventLabel()}</small>
          {socials.length > 0 && <nav className="m-footer-social" aria-label="Social links">{socials.map(([network, href]) => { const Icon = { instagram: Camera, x: Share2, linkedin: BriefcaseBusiness, whatsapp: MessageCircle }[network]; const label = network === "x" ? "X" : network[0].toUpperCase() + network.slice(1); return <a key={network} href={href} aria-label={`${label} (opens in a new tab)`} target="_blank" rel="noopener noreferrer"><Icon size={18} aria-hidden="true" /></a>; })}</nav>}
        </section>
        <nav className="m-footer-links" aria-label="Footer">
          {groups.filter((group) => group.links.length).map((group) => <section key={group.title}><h2 className="m-mono">{group.title}</h2><ul>{group.links.map((link) => <li key={link.label}><Link href={link.href === "/docs" ? site.docsUrl : link.href}>{link.label}</Link></li>)}</ul></section>)}
        </nav>
      </div>
      <div className="m-footer-trust" aria-label="Ticketing details"><span><LockKeyhole size={15} aria-hidden="true" />Cashfree secure checkout</span><span><Mail size={15} aria-hidden="true" />Email tickets · WhatsApp when enabled</span><span><QrCode size={15} aria-hidden="true" />Signed QR tickets</span></div>
      <div className="m-footer-utility"><div className="m-footer-meta"><p>© {new Date().getFullYear()} {APP_NAME} · Made in India, for events everywhere.</p></div><nav className="m-footer-legal" aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/refunds">Refunds</Link></nav><FooterControls /></div>
    </div>
  </footer>;
}

export function FooterMinimal() {
  return <footer className="m-footer-minimal"><div className="m-container"><span>© {new Date().getFullYear()} {APP_NAME}</span><nav aria-label="Footer"><Link href="/help">Help</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></div></footer>;
}

export function RouteFooter({ pathname, landing = false }: { pathname: string; landing?: boolean }) {
  const variant = footerVariantForPath(pathname);
  if (variant === "none") return null;
  if (variant === "minimal") return <FooterMinimal />;
  return <MarketingFooter variant={landing ? "landing" : "full"} />;
}
