import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { EventImage } from "@/components/public/event-image";

it("renders a skeleton until a preview exists", () => {
  const html = renderToStaticMarkup(
    createElement(EventImage, { variants: null, alt: "Event cover" }),
  );
  expect(html).toContain("loading");
  expect(html).not.toContain("<img");
});
it("uses partial JPEG previews with lazy cards and eager heroes", () => {
  const variants = {
    card: { jpeg: "https://images.test/card.jpg" },
    hero: { jpeg: "https://images.test/hero.jpg" },
  };
  const card = renderToStaticMarkup(
    createElement(EventImage, { variants, alt: "Event cover", size: "card" }),
  );
  expect(card).toContain('loading="lazy"');
  expect(card).toContain('alt="Event cover"');
  expect(card).toContain('src="https://images.test/card.jpg"');
  const hero = renderToStaticMarkup(
    createElement(EventImage, { variants, alt: "Event cover", size: "hero" }),
  );
  expect(hero).toContain('loading="eager"');
});
