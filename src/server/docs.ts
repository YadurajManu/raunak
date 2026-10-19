import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { docHeadings, docsPages, resolveDoc, type DocSearchEntry } from "@/lib/docs";

export const loadDoc = cache(async (slug: string) => {
  const page = resolveDoc(slug);
  if (!page) return null;
  const markdown = await readFile(path.join(process.cwd(), "docs", "public", `${page.slug}.md`), "utf8");
  return { ...page, markdown, headings: docHeadings(markdown) };
});

export async function docsSearchIndex(): Promise<DocSearchEntry[]> {
  const documents = await Promise.all(docsPages.map((page) => loadDoc(page.slug)));
  return documents.flatMap((doc) => doc ? [
    { title: doc.title, text: `${doc.description} ${doc.markdown.replace(/[#`*\[\]]/g, "").replace(/\s+/g, " ")}`, href: `/docs/${doc.slug}`, group: doc.group },
    ...doc.headings.filter((heading) => heading.level > 1).map((heading) => ({ title: heading.text, text: `${doc.title} ${doc.description}`, href: `/docs/${doc.slug}#${heading.id}`, group: doc.title })),
  ] : []);
}
