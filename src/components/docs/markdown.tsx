import { Children, isValidElement, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Info, TriangleAlert } from "lucide-react";
import { documentationDiagram, documentationLink, headingId } from "@/lib/docs";
import { CopyButton, HeadingLink } from "./copy-button";
import { DocsDiagram } from "./diagrams";

function contentText(children: ReactNode): string {
  return Children.toArray(children).map((child) => typeof child === "string" || typeof child === "number" ? String(child) : isValidElement<{ children?: ReactNode }>(child) ? contentText(child.props.children) : "").join("");
}

function highlighted(text: string) {
  return text.split(/(#[^\n]*|"[^"\n]*"|'[^'\n]*'|\b(?:pnpm|git|docker|openssl|node|true|false|null)\b|\b[A-Z][A-Z_0-9]{2,}\b)/g).map((part, index) => <span key={index} className={part.startsWith("#") ? "docs-code-comment" : /^["']/.test(part) ? "docs-code-string" : /^(pnpm|git|docker|openssl|node|true|false|null)$/.test(part) ? "docs-code-keyword" : /^[A-Z][A-Z_0-9]{2,}$/.test(part) ? "docs-code-variable" : undefined}>{part}</span>);
}

type MarkdownNode = { type: string; depth?: number; value?: string; children?: MarkdownNode[]; data?: { hProperties?: Record<string, string> } };
function headingAnchors() {
  return (tree: MarkdownNode) => {
    const seen = new Map<string, number>();
    const nodeText = (node: MarkdownNode): string => node.value || node.children?.map(nodeText).join("") || "";
    const visit = (node: MarkdownNode) => {
      if (node.type === "heading") {
        const base = headingId(nodeText(node));
        const count = seen.get(base) || 0;
        seen.set(base, count + 1);
        node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id: count ? `${base}-${count}` : base } };
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

export function DocsMarkdown({ markdown }: { markdown: string }) {
  return <div className="docs-prose"><Markdown remarkPlugins={[remarkGfm, headingAnchors]} components={{
    a: ({ href, children, title }) => <a href={documentationLink(href || "")} title={title}>{children}</a>,
    h1: ({ children }) => <h1>{children}</h1>,
    h2: ({ children, id }) => <h2 id={id}>{children}<HeadingLink id={id || headingId(contentText(children))} title={contentText(children)} /></h2>,
    h3: ({ children, id }) => <h3 id={id}>{children}<HeadingLink id={id || headingId(contentText(children))} title={contentText(children)} /></h3>,
    pre: ({ children }) => {
      const code = Children.toArray(children).find((child) => isValidElement(child));
      if (!isValidElement<{ className?: string; children?: ReactNode }>(code)) return <pre tabIndex={0} aria-label="Scrollable code example">{children}</pre>;
      const text = contentText(code.props.children).replace(/\n$/, "");
      const language = code.props.className?.replace("language-", "") || "text";
      const diagram = language === "mermaid" ? documentationDiagram(text) : null;
      if (diagram) return <DocsDiagram kind={diagram} />;
      return <div className="docs-code-block"><div className="docs-code-toolbar"><span>{language === "bash" || language === "sh" ? "Terminal" : language}</span><CopyButton text={text} /></div><pre tabIndex={0} aria-label={`Scrollable ${language === "bash" || language === "sh" ? "terminal" : language} example`}><code>{highlighted(text)}</code></pre></div>;
    },
    table: ({ children }) => <div className="docs-table-scroll" tabIndex={0} role="region" aria-label="Scrollable reference table"><table>{children}</table></div>,
    blockquote: ({ children }) => {
      const text = contentText(children);
      const match = /\[!(NOTE|IMPORTANT|WARNING|TIP|CAUTION)\]/.exec(text);
      if (!match) return <blockquote>{children}</blockquote>;
      const clean = Children.map(children, (child) => {
        if (!isValidElement<{ children?: ReactNode }>(child)) return child;
        return <div>{Children.map(child.props.children, (part) => typeof part === "string" ? part.replace(/\[!(NOTE|IMPORTANT|WARNING|TIP|CAUTION)\]\s*/, "") : part)}</div>;
      });
      return <div role="note" className={`docs-callout ${match[1] === "WARNING" || match[1] === "CAUTION" ? "is-warning" : ""}`}><div>{match[1] === "WARNING" || match[1] === "CAUTION" ? <TriangleAlert size={18} aria-hidden="true" /> : <Info size={18} aria-hidden="true" />}<strong>{match[1].toLowerCase()}</strong></div>{clean}</div>;
    },
  }}>{markdown}</Markdown></div>;
}
