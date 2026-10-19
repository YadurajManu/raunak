import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { docHeadings, docsPages, documentationLink } from "@/lib/docs";

it("keeps every published guide and local Markdown destination resolvable", () => {
  const root = process.cwd();
  for (const page of docsPages) {
    const source = path.join(root, "docs/public", `${page.slug}.md`);
    const markdown = readFileSync(source, "utf8");
    expect(docHeadings(markdown).filter((heading) => heading.level === 1)).toHaveLength(1);
    for (const [, destination] of markdown.matchAll(/\]\(([^\s)]+)\)/g)) {
      if (/^(https?:|mailto:|\/)/.test(destination)) continue;
      const [file, fragment] = destination.split("#");
      const target = file ? path.resolve(path.dirname(source), file) : source;
      expect(existsSync(target), `${page.slug}: ${destination}`).toBe(true);
      if (fragment && target.endsWith(".md")) {
        expect(docHeadings(readFileSync(target, "utf8")).some((heading) => heading.id === fragment), destination).toBe(true);
      }
      if (/^[a-z-]+\.md/.test(destination)) expect(documentationLink(destination)).toMatch(/^\/docs\//);
    }
  }
});

it("keeps the README's checked-in image and file links valid", () => {
  const markdown = readFileSync("README.md", "utf8");
  const links = [
    ...Array.from(markdown.matchAll(/\]\(([^\s)]+)\)/g), (match) => match[1]),
    ...Array.from(markdown.matchAll(/(?:src|href)="([^"]+)"/g), (match) => match[1]),
  ];
  for (const link of links) {
    if (/^(https?:|mailto:|#)/.test(link)) continue;
    const [file] = link.split("#");
    expect(existsSync(file), `README: ${link}`).toBe(true);
  }
});
