export const mediaRoles = ["COVER", "POSTER", "GALLERY", "PERSON"] as const;
export type MediaRole = (typeof mediaRoles)[number];
export const roleNames: Record<MediaRole, string> = {
  COVER: "Cover",
  POSTER: "Poster",
  GALLERY: "Gallery",
  PERSON: "Person photo",
};
export type MediaImage = {
  id: string;
  kind: string;
  alt: string;
  storageKey: string;
  sortOrder: number;
  variants: unknown;
  processingError: string | null;
  crop?: unknown;
  sizeBytes: number;
  mime: string;
  width: number | null;
  height: number | null;
};
export type LineupPerson = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  photoKey: string | null;
  links?: unknown;
};
