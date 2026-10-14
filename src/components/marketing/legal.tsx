import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="m-legal m-container">
      <Link href="/" className="m-logo">
        <span className="m-logo-mark" aria-hidden="true">
          ◔
        </span>
        {APP_NAME}
      </Link>
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
