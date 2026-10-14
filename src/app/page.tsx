import { APP_NAME } from "@/lib/constants";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8 sm:px-10">
      <header className="flex items-center justify-between border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <span className="text-xl font-semibold tracking-tight">{APP_NAME}</span>
        <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">Phase 1 in development</span>
      </header>
      <section className="flex flex-1 flex-col justify-center py-20">
        <p className="mb-5 text-sm font-medium uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Made for events in India</p>
        <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight sm:text-7xl">Bring people together, beautifully.</h1>
        <p className="mt-8 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">Create events, sell tickets, and welcome guests from one calm workspace. Eventra is currently being built.</p>
      </section>
      <footer className="border-t border-zinc-200 py-6 text-sm text-zinc-500 dark:border-zinc-800">{APP_NAME} · Event management and ticketing</footer>
    </main>
  );
}
