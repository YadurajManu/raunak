"use client";
export default function Error({ reset }: { reset(): void }) {
  return (
    <main className="market-page">
      <h1>Your wallet could not load.</h1>
      <p>This does not mean your bookings are missing. Please try again.</p>
      <button className="m-button" onClick={reset}>
        Reload wallet
      </button>
    </main>
  );
}
