"use client";
export default function Error({ reset }: { reset(): void }) {
  return (
    <main className="market-page">
      <h1>We could not load events.</h1>
      <p>Your filters are still in the address bar. Please try again.</p>
      <button className="m-button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
