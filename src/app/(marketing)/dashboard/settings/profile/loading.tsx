import "@/components/dashboard/profile-editor.css";

export default function ProfileLoading() {
  return (
    <main
      className="pe-page"
      aria-busy="true"
      aria-label="Loading organizer profile"
    >
      <div className="pe-loading-rail" />
      <div className="pe-loading-main">
        <div />
        <div />
        <div />
      </div>
      <div className="pe-loading-preview" />
    </main>
  );
}
