import { afterEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
const event = vi.hoisted(() => vi.fn());
vi.mock("@/server/public/events", () => ({ publicEvent: event }));
import Image from "@/app/(marketing)/e/[slug]/opengraph-image";
afterEach(() => {
  vi.unstubAllGlobals();
});
it("serves the real poster as a public social image with declared dimensions", async () => {
  event.mockResolvedValue({
    title: "Garba Night",
    images: [
      {
        kind: "POSTER",
        variants: { og: { jpeg: "https://raunak.example/poster.jpg" } },
      },
    ],
  });
  const fetchImage = vi
    .fn()
    .mockResolvedValue(
      new Response(await readFile("tests/fixtures/source.png")),
    );
  vi.stubGlobal("fetch", fetchImage);
  const response = await Image({
    params: Promise.resolve({ slug: "garba-night" }),
  });
  expect(fetchImage).toHaveBeenCalledWith("https://raunak.example/poster.jpg");
  expect(response.headers.get("Content-Type")).toBe("image/png");
  const metadata = await sharp(await response.arrayBuffer()).metadata();
  expect([metadata.width, metadata.height]).toEqual([1200, 630]);
});
