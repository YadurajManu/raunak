import { notFound } from "next/navigation";
import { CheckinScanner } from "@/components/dashboard/checkin-scanner";
export default function CheckinPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="ops-page">
      <header className="gate-page-heading">
        <div>
          <h1>Guest check-in</h1>
          <p>Internal component preview</p>
        </div>
      </header>
      <CheckinScanner eventId="b848f6c5-d485-4f25-b798-0278e72e8943" />
    </main>
  );
}
