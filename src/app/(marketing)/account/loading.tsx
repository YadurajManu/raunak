export default function LoadingPlans() {
  return (
    <main
      className="plans-page"
      aria-busy="true"
      aria-label="Loading your plans"
    >
      <h1>My plans</h1>
      <p role="status">Getting your tickets and plans ready…</p>
      <div className="plans-loading" aria-hidden="true">
        <div className="plans-skeleton" />
        <div className="plans-skeleton" />
        <div className="plans-skeleton plans-skeleton-ticket" />
        <div className="plans-skeleton plans-skeleton-ticket" />
      </div>
    </main>
  );
}
