import { PageHeader } from "@/components/ui";
export default function Loading() {
  return (
    <main className="market-page" aria-busy="true">
      <PageHeader title="My tickets" description="Your event tickets and booking details." />
      <p role="status">Loading your ticket wallet…</p>
      <div className="market-grid">
        {[1, 2, 3].map((v) => (
          <div className="market-skeleton" key={v} />
        ))}
      </div>
    </main>
  );
}
