"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowRight, BookOpen, ChevronDown, CodeXml, Menu, Moon, Search, Sun, X } from "lucide-react";
import { docsGroups, docsPages, searchDocs, type DocSearchEntry } from "@/lib/docs";

const subscribeTheme = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("raunak-docs-theme", callback);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("raunak-docs-theme", callback); media.removeEventListener("change", callback); };
};
const themeSnapshot = () => document.documentElement.dataset.marketingTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

function ThemeButton() {
  const theme = useSyncExternalStore(subscribeTheme, themeSnapshot, () => "light");
  const action = `Switch to ${theme === "dark" ? "light" : "dark"} mode`;
  return <button className="docs-icon-button" aria-label={action} title={action} onClick={() => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.marketingTheme = next;
    try { localStorage.setItem("raunak-theme", next); } catch { /* Theme still works when storage is unavailable. */ }
    window.dispatchEvent(new Event("raunak-docs-theme"));
  }}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>;
}

function DocsNavigation({ close }: { close?: () => void }) {
  const pathname = usePathname();
  return <nav aria-label="Documentation">
    <Link className={`docs-overview-link ${pathname === "/docs" ? "is-active" : ""}`} aria-current={pathname === "/docs" ? "page" : undefined} href="/docs" onClick={close}><BookOpen size={16} aria-hidden="true" /> Overview</Link>
    {docsGroups.map((group) => <details className="docs-nav-group" open key={group}>
      <summary>{group}<ChevronDown size={14} aria-hidden="true" /></summary>
      {docsPages.filter((page) => page.group === group).map((page) => <Link key={page.slug} className={pathname === `/docs/${page.slug}` ? "is-active" : ""} href={`/docs/${page.slug}`} aria-current={pathname === `/docs/${page.slug}` ? "page" : undefined} onClick={close}>{page.title}</Link>)}
    </details>)}
  </nav>;
}

function DocsSearch({ index }: { index: DocSearchEntry[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const results = searchDocs(index, query);
  function open() { dialog.current?.showModal(); input.current?.focus(); }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialog.current?.open) dialog.current.close(); else open();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (dialog.current?.open) document.getElementById(`docs-result-${selected}`)?.scrollIntoView({ block: "nearest" });
  }, [selected, query]);
  return <>
    <button className="docs-search-trigger" ref={trigger} onClick={open}><Search size={17} aria-hidden="true" /><span className="docs-search-label">Search documentation</span><kbd aria-hidden="true">⌘ K</kbd></button>
    <dialog className="docs-search-dialog" ref={dialog} aria-labelledby="docs-search-title" onClose={() => trigger.current?.focus()} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="docs-search-box">
        <div className="docs-search-input-row">
          <Search size={20} aria-hidden="true" />
          <label className="docs-sr-only" id="docs-search-title" htmlFor="docs-search-input">Search documentation</label>
          <input ref={input} id="docs-search-input" placeholder="Search pages and headings…" value={query} autoComplete="off" role="combobox" aria-autocomplete="list" aria-controls="docs-search-results" aria-expanded={true} aria-activedescendant={results.length ? `docs-result-${Math.min(selected, results.length - 1)}` : undefined} onChange={(event) => { setQuery(event.target.value); setSelected(0); }} onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); if (results.length) setSelected((current) => Math.min(current + 1, results.length - 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setSelected((current) => Math.max(0, current - 1)); }
            if (event.key === "Enter" && results[selected]) { event.preventDefault(); document.getElementById(`docs-result-${selected}`)?.click(); }
          }} />
          <button className="docs-icon-button" aria-label="Close search" onClick={() => dialog.current?.close()}><X size={18} /></button>
        </div>
        <p className="docs-search-count" aria-live="polite">{query ? `${results.length} ${results.length === 1 ? "result" : "results"}` : "Start with a guide"}</p>
        <ul id="docs-search-results" role="listbox" aria-label="Search results">
          {results.map((result, i) => <li role="presentation" key={result.href}>
            <Link id={`docs-result-${i}`} role="option" aria-selected={selected === i} tabIndex={-1} href={result.href} onClick={() => dialog.current?.close()} onFocus={() => setSelected(i)}><span><small>{result.group}</small><strong>{result.title}</strong></span><ArrowRight size={17} aria-hidden="true" /></Link>
          </li>)}
        </ul>
        {results.length === 0 && <div className="docs-search-empty"><strong>No matching pages.</strong><p>Try “tickets”, “Firebase” or “local setup”.</p><button onClick={() => { setQuery(""); input.current?.focus(); }}>Clear search</button></div>}
        <p className="docs-search-help"><span>↑ ↓ to navigate · Enter to open</span><span>Esc to close</span></p>
      </div>
    </dialog>
  </>;
}

export function DocsFrame({ children, searchIndex }: { children: ReactNode; searchIndex: DocSearchEntry[] }) {
  const drawer = useRef<HTMLDialogElement>(null);
  return <div className="raunak-docs">
    <a className="docs-skip" href="#docs-content">Skip to content</a>
    <header className="docs-header">
      <Link href="/docs" className="docs-brand"><Image src="/brand/icon-192.png" width={32} height={32} alt="" /><span>Raunak</span>{" "}<b>Docs</b></Link>
      <div className="docs-header-actions"><DocsSearch index={searchIndex} /><a className="docs-product-link" href="https://raunak.yaduraj.me">Open Raunak <ArrowRight size={15} aria-hidden="true" /></a><a className="docs-icon-button docs-github-link" href="https://github.com/YadurajManu/raunak" aria-label="Raunak on GitHub"><CodeXml size={19} /></a><ThemeButton /><button className="docs-icon-button docs-mobile-toggle" aria-label="Open documentation navigation" onClick={() => drawer.current?.showModal()}><Menu size={20} /></button></div>
    </header>
    <div className="docs-layout"><aside className="docs-sidebar" aria-label="Documentation chapters"><DocsNavigation /><p className="docs-sidebar-note">A little less admin.<br />A lot more event.</p></aside><div className="docs-content-wrap" id="docs-content" tabIndex={-1}>{children}</div></div>
    <dialog ref={drawer} className="docs-nav-dialog" aria-label="Documentation navigation" onClick={(event) => { if (event.target === event.currentTarget) drawer.current?.close(); }}><div className="docs-drawer-head"><strong>Explore the docs</strong><button className="docs-icon-button" aria-label="Close navigation" onClick={() => drawer.current?.close()}><X size={20} /></button></div><DocsNavigation close={() => drawer.current?.close()} /><a className="docs-mobile-product" href="https://raunak.yaduraj.me">Open Raunak <ArrowRight size={16} /></a></dialog>
    <footer className="docs-footer"><div><Link href="/docs" className="docs-footer-logo">Raunak<span>Made for getting together.</span></Link><p>Discover a good plan.<br />Build a better event.</p></div><nav aria-label="Documentation footer"><a href="https://raunak.yaduraj.me">Open the product</a><Link href="/docs/installation">Get started locally</Link><a href="https://github.com/YadurajManu/raunak">Source on GitHub</a><Link href="/docs/contributing">Contributing & license</Link></nav><small>Original source: MIT · Third-party services and assets retain their own terms.</small></footer>
  </div>;
}
