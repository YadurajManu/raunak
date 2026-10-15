import Link from "next/link";
export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="m-legal m-container">
      <div className="m-legal-content">
        <p className="m-eyebrow">THE SMALL PRINT</p>
        <h1>{title}</h1>
        <p className="m-legal-draft">
          Draft policy · Updated 14 October 2026 · Subject to legal review
          before launch.
        </p>
        {children}
        <Link href="/" className="m-text-link">
          Back to the good part ↗
        </Link>
      </div>
    </main>
  );
}
