"use client";
import { useState } from "react";
import { Card, FormField, ImageField, InitialsAvatar, PageHeader, Section, SectionHeader, SegmentedControl, StatusChip, StickySaveBar } from ".";

export function CalmComponentsPreview() {
  const [dirty, setDirty] = useState(false);
  const [value, setValue] = useState("desktop");
  return <main className="plans-page"><PageHeader backHref="/style-guide/calm-ui" backLabel="Component preview" title="Calm utility components" description="SAMPLE DATA · Existing brand tokens, light and dark." /><SectionHeader title="Shared patterns" count={10} /><Section title="Profile details" description="Sections use spacing and a hairline." id="details"><form id="calm-demo" onSubmit={event => { event.preventDefault(); setDirty(false); }}><FormField label="Community name" htmlFor="demo-name" hint="Shown on your public page." counter="16/160"><input id="demo-name" defaultValue="Sample community" onChange={() => setDirty(true)} aria-describedby="demo-name-hint" /></FormField></form><InitialsAvatar name="Sample community" size={48} /> <StatusChip tone="success">Visible</StatusChip><SegmentedControl label="Preview size" value={value} options={[{value:"desktop",label:"Desktop"},{value:"mobile",label:"Mobile"}]} onChange={setValue} /></Section><Section title="Images"><ImageField label="Upload photo" hint="Sample component only; no upload is sent." onFiles={() => setDirty(true)} /></Section><Card>A distinct preview object uses one card.</Card><StickySaveBar dirty={dirty} busy={false} onDiscard={() => setDirty(false)} formId="calm-demo" /></main>;
}
