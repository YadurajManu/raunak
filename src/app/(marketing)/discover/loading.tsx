export default function Loading() {
  return (
    <main className="market-page" aria-busy="true" aria-label="Loading events">
      <p role="status">Finding good plans…</p>
      <div className="market-grid">
        {[1, 2, 3, 4].map((v) => (
          <div key={v} className="market-skeleton" />
        ))}
      </div>
    </main>
  );
}
