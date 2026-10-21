import { notFound } from "next/navigation";
import { EventCard } from "@/components/public/event-card";
import { ProfileEditorFixture } from "@/components/dashboard/profile-editor-fixture";
import { CalmComponentsPreview } from "@/components/ui/calm-preview";
import { PageHeader, SectionHeader } from "@/components/ui";

export default async function CalmPreview({ searchParams }: { searchParams: Promise<{view?:string}> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view } = await searchParams;
  if (view === "profile") return <ProfileEditorFixture />;
  if (view === "profile-readonly") return <ProfileEditorFixture readOnly />;
  if (view === "components") return <CalmComponentsPreview />;
  return <main className="plans-page"><p>SAMPLE DATA · COMPONENT PREVIEW</p><PageHeader title="My plans" description="Your upcoming tickets and saved events." /><section className="plans-section"><SectionHeader title="Saved for later" count={1} actions={<a href="/saved">View all saved →</a>} /><ul className="plans-saved-grid"><EventCard saved variant="saved" event={{ id:"b848f6c5-d485-4f25-b798-0278e72e8943",slug:"sample-campus-fest",title:"Campus Fest — an evening together",startsAt:new Date("2027-02-20T10:30:00Z"),timezone:"Asia/Kolkata",city:"Pune",venueName:"Sample campus lawn",category:"Arts & culture",mode:"IN_PERSON",org:{name:"Sample community",slug:"sample-community"},images:[{kind:"POSTER",alt:"Sample artwork",variants:{card:{jpeg:"/seed/campus-fest.svg"}}}],ticketTypes:[{pricePaise:1000}]}} /></ul></section><section className="plans-section"><SectionHeader title="Recent orders" count={0} actions={<a href="/account?tab=orders">View orders →</a>} /><p>No bookings yet. Payment and refund details will appear here after you book.</p></section></main>;
}
