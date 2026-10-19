export const docsPages = [
  { slug: "introduction", title: "Meet Raunak", group: "Start here", description: "The product, the people and the two journeys." },
  { slug: "installation", title: "Local quick start", group: "Start here", description: "Install, configure and run your first local instance." },
  { slug: "attendees", title: "For attendees", group: "Product", description: "Discover a plan, book and find your ticket." },
  { slug: "organizers", title: "For organizers", group: "Product", description: "Create a workspace and publish your event." },
  { slug: "tickets-check-in", title: "Tickets & check-in", group: "Product", description: "Admission QRs, manual lookup and safe entry." },
  { slug: "architecture", title: "How it works", group: "Build", description: "Services, booking states and background jobs." },
  { slug: "integrations", title: "Integrations", group: "Build", description: "Authentication, payments, storage and delivery." },
  { slug: "development", title: "Development & testing", group: "Operate", description: "Commands, focused checks and local workflows." },
  { slug: "deployment", title: "Deployment", group: "Operate", description: "Build the web app and operate the separate worker." },
  { slug: "troubleshooting", title: "Troubleshooting", group: "Operate", description: "Work through common setup and delivery problems." },
  { slug: "reference", title: "Configuration reference", group: "Reference", description: "Environment variables, scripts and route boundaries." },
  { slug: "contributing", title: "Contributing & license", group: "Project", description: "Make a focused contribution and report issues safely." },
] as const;

export type DocPage = (typeof docsPages)[number];
export type DocHeading = { id: string; text: string; level: number };
export type DocSearchEntry = { title: string; text: string; href: string; group: string };
export type DocDiagramKind = "architecture" | "booking" | "publishing";
export const docsGroups = [...new Set(docsPages.map((page) => page.group))];

export function documentationDiagram(source: string): DocDiagramKind | null {
  const marker = /^\s*%%\s*raunak:(architecture|booking|publishing)\s*$/m.exec(source);
  return marker ? marker[1] as DocDiagramKind : null;
}

export function resolveDoc(slug: string) {
  return docsPages.find((page) => page.slug === slug);
}

export function documentationLink(href: string) {
  const local = /^(?:\.\/)?([a-z-]+)\.md(#[^\s]*)?$/.exec(href);
  if (local && resolveDoc(local[1])) return `/docs/${local[1]}${local[2] || ""}`;
  const projectFiles: Record<string, string> = {
    "../../CONTRIBUTING.md": "CONTRIBUTING.md",
    "../../SECURITY.md": "SECURITY.md",
    "../../LICENSE": "LICENSE",
  };
  return projectFiles[href] ? `https://github.com/YadurajManu/raunak/blob/master/${projectFiles[href]}` : href;
}

export function headingId(text: string) {
  return text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-") || "section";
}

export function docHeadings(markdown: string): DocHeading[] {
  let fence = false;
  const seen = new Map<string, number>();
  return markdown.split("\n").flatMap((line) => {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return []; }
    if (fence) return [];
    const match = /^(#{1,3})\s+(.+?)\s*#*$/.exec(line);
    if (!match) return [];
    const text = match[2].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[`*_]/g, "");
    const base = headingId(text);
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return [{ id: count ? `${base}-${count}` : base, text, level: match[1].length }];
  });
}

export function searchDocs(entries: DocSearchEntry[], query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return entries.filter((entry) => !entry.href.includes("#")).slice(0, 6);
  return entries
    .map((entry, index) => {
      const title = entry.title.toLowerCase();
      const content = `${title} ${entry.text}`.toLowerCase();
      return { entry, index, score: terms.every((term) => content.includes(term)) ? terms.reduce((score, term) => score + (title.includes(term) ? 3 : 1), 0) : 0 };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 12)
    .map(({ entry }) => entry);
}
