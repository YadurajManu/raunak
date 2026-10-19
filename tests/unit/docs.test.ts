import { describe, expect, it } from "vitest";
import { docHeadings, documentationDiagram, documentationLink, docsPages, resolveDoc, searchDocs } from "@/lib/docs";

describe("public documentation content", () => {
  it("resolves only explicit public slugs", () => {
    expect(resolveDoc("installation")?.title).toBe("Local quick start");
    for (const slug of ["../deployment", "%2e%2e", "deployment.md", "", "README"]) expect(resolveDoc(slug)).toBeUndefined();
    expect(new Set(docsPages.map((page) => page.slug)).size).toBe(docsPages.length);
  });

  it("creates stable unique heading links without indexing fenced examples", () => {
    expect(docHeadings("# Hello\n## A `command`\n```sh\n## hidden\n```\n## A command")).toEqual([
      { id: "hello", text: "Hello", level: 1 },
      { id: "a-command", text: "A command", level: 2 },
      { id: "a-command-1", text: "A command", level: 2 },
    ]);
  });

  it("finds page and heading matches with every query term", () => {
    const index = [
      { title: "Cashfree setup", text: "Payments configuration", href: "/docs/integrations#cashfree", group: "Build" },
      { title: "Integrations", text: "Providers", href: "/docs/integrations", group: "Build" },
    ];
    expect(searchDocs(index, "cashfree payments").map((entry) => entry.href)).toEqual(["/docs/integrations#cashfree"]);
    expect(searchDocs(index, "nomatch")).toEqual([]);
    expect(searchDocs(index, "").map((entry) => entry.href)).toEqual(["/docs/integrations"]);
  });

  it("rewrites only known checked-in guide links for the website", () => {
    expect(documentationLink("installation.md#configure-firebase")).toBe("/docs/installation#configure-firebase");
    expect(documentationLink("../../SECURITY.md")).toBe("https://github.com/YadurajManu/raunak/blob/master/SECURITY.md");
    expect(documentationLink("../../private.md")).toBe("../../private.md");
    expect(documentationLink("https://example.test/x")).toBe("https://example.test/x");
  });

  it("selects diagrams by explicit marker instead of guessing from provider words", () => {
    expect(documentationDiagram("%% raunak:architecture\nflowchart TD\n Web --> Cashfree")).toBe("architecture");
    expect(documentationDiagram("%% raunak:booking\nflowchart TD\nCart --> Hold")).toBe("booking");
    expect(documentationDiagram("%% raunak:publishing\nflowchart TD\nDraft --> Review")).toBe("publishing");
    expect(documentationDiagram("flowchart TD\nWeb --> Cashfree")).toBeNull();
    expect(documentationDiagram("%% raunak:unknown\nflowchart TD")).toBeNull();
  });
});
