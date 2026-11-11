import { beforeEach, expect, it, vi } from "vitest";
import sharp from "sharp";
const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
}));
vi.mock("@/server/db/client", () => ({
  db: {
    eventImage: { findUnique: mocks.findUnique, updateMany: mocks.updateMany },
  },
}));
vi.mock("@/server/providers/storage/s3", () => ({
  storage: {
    read: mocks.read,
    write: mocks.write,
    publicUrl: (key: string) => `https://images.test/${key}`,
  },
}));
import { processMedia } from "../../worker/jobs/process-media";
let image: { id: string; storageKey: string; crop: null; variants: unknown };
let snapshots: Record<string, Record<string, string>>[];
beforeEach(async () => {
  vi.resetAllMocks();
  image = {
    id: "image",
    storageKey: "orgs/org/events/event/original/image",
    crop: null,
    variants: null,
  };
  snapshots = [];
  mocks.findUnique.mockImplementation(async () => structuredClone(image));
  mocks.read.mockResolvedValue(
    await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#cc4400" },
    })
      .png()
      .toBuffer(),
  );
  mocks.write.mockResolvedValue(undefined);
  mocks.updateMany.mockImplementation(async ({ data }) => {
    if (data.variants) {
      image.variants = structuredClone(data.variants);
      snapshots.push(structuredClone(data.variants));
    }
    return { count: 1 };
  });
});
it("publishes JPEG previews before additional formats and skips completed images", async () => {
  await processMedia("image");
  expect(
    mocks.write.mock.calls.slice(0, 4).map(([key]) => key.split("/").at(-1)),
  ).toEqual(["card.jpg", "hero.jpg", "thumb.jpg", "og.jpg"]);
  expect(Object.keys(snapshots[0].card)).toEqual(["jpeg"]);
  expect(snapshots[0].hero.jpeg).toBeTruthy();
  expect(snapshots.at(-1)?.og.avif).toBeTruthy();
  expect(mocks.write).toHaveBeenCalledTimes(12);
  await processMedia("image");
  expect(mocks.read).toHaveBeenCalledTimes(1);
});
it("keeps previews usable on a later encoding failure and completes them on retry", async () => {
  mocks.write.mockImplementation(async (key: string) => {
    if (key.endsWith(".webp")) throw new Error("temporary storage failure");
  });
  await expect(processMedia("image")).rejects.toThrow(
    "temporary storage failure",
  );
  expect(snapshots[0].card.jpeg).toBeTruthy();
  mocks.write.mockResolvedValue(undefined);
  await processMedia("image");
  expect(snapshots.at(-1)?.og.avif).toBeTruthy();
});
it("stops after a crop changes or the image is deleted during processing", async () => {
  mocks.updateMany.mockResolvedValue({ count: 0 });
  await processMedia("image");
  expect(mocks.write).toHaveBeenCalledTimes(4);
});
