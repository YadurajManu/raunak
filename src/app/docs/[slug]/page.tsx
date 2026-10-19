import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { docsPages } from "@/lib/docs";
import { loadDoc } from "@/server/docs";
import { DocsMarkdown } from "@/components/docs/markdown";

export const dynamicParams = false;
export function generateStaticParams() { return docsPages.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const doc = await loadDoc((await params).slug);
  if (!doc) return { title: "Page not found" };
  return { title: doc.title, description: doc.description, alternates: { canonical: `https://raunak.yaduraj.me/docs/${doc.slug}` }, openGraph: { title: `${doc.title} · Raunak docs`, description: doc.description, url: `https://raunak.yaduraj.me/docs/${doc.slug}` } };
}

export default async function DocumentationPage({ params }: { params: Promise<{ slug: string }> }) {
  const doc = await loadDoc((await params).slug);
  if (!doc) notFound();
  const index = docsPages.findIndex((page) => page.slug === doc.slug);
  const previous = docsPages[index - 1];
  const next = docsPages[index + 1];
  const toc = doc.headings.filter((heading) => heading.level > 1);
  return <div className="docs-guide-layout"><main className="docs-guide">
    <nav className="docs-breadcrumbs" aria-label="Breadcrumb"><Link href="/docs">Docs</Link><span aria-hidden="true">/</span><span>{doc.group}</span></nav>
    <DocsMarkdown markdown={doc.markdown} />
    <nav className="docs-pagination" aria-label="Previous and next documentation page">
      {previous ? <Link href={`/docs/${previous.slug}`}><ArrowLeft size={17} aria-hidden="true" /><span><small>Previous</small>{previous.title}</span></Link> : <Link href="/docs"><ArrowLeft size={17} aria-hidden="true" /><span><small>Previous</small>Overview</span></Link>}
      {next && <Link href={`/docs/${next.slug}`}><span><small>Next</small>{next.title}</span><ArrowRight size={17} aria-hidden="true" /></Link>}
    </nav>
    <p className="docs-edit"><a href={`https://github.com/YadurajManu/raunak/blob/master/docs/public/${doc.slug}.md`}>View this page’s source on GitHub <ArrowRight size={13} aria-hidden="true" /></a></p>
  </main>{toc.length > 0 && <aside className="docs-toc" aria-label="Current page outline"><details open><summary>On this page</summary><nav aria-label="On this page">{toc.map((heading) => <a className={heading.level === 3 ? "is-subheading" : undefined} key={heading.id} href={`#${heading.id}`}>{heading.text}</a>)}</nav></details></aside>}</div>;
}
