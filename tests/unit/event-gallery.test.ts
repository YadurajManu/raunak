import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EventGallery } from "@/components/public/event-gallery";

function renderGallery(count: number) {
  return renderToStaticMarkup(
    createElement(EventGallery, {
      photos: Array.from({ length: count }, (_, index) => ({
        id: `photo-${index + 1}`,
        variants: {},
        alt: `Event photo ${index + 1}`,
      })),
    }),
  );
}

describe("event photo gallery layout", () => {
  it("keeps a single photo wide and balanced", () => {
    const html = renderGallery(1);
    expect(html).toContain('data-layout="single"');
    expect(html.match(/class="r-event-gallery-item"/g)).toHaveLength(1);
  });

  it("shows both photos in the balanced two-photo layout", () => {
    const html = renderGallery(2);
    expect(html).toContain('data-layout="pair"');
    expect(html.match(/class="r-event-gallery-item"/g)).toHaveLength(2);
  });

  it("uses a three-photo mosaic and opens the full set from its last tile", () => {
    const html = renderGallery(5);
    expect(html).toContain('data-layout="mosaic"');
    expect(html.match(/class="r-event-gallery-item"/g)).toHaveLength(3);
    expect(html).toContain("View all 5 photos");
    expect(html).toContain('aria-label="Event photo viewer"');
  });
});
