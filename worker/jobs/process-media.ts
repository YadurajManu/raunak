import sharp from "sharp";
import { encode } from "blurhash";
import { fileTypeFromBuffer } from "file-type";
import heicConvert from "heic-convert";
import { db } from "../../src/server/db/client";
import { storage } from "../../src/server/providers/storage/s3";
import { cropRegion, cropSchema } from "../../src/lib/image-crop";
import { Prisma } from "../../src/generated/prisma/client";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const allowed = new Set(["jpg", "png", "webp", "avif", "gif", "heic", "heif"]);
const sizes = { thumb: 320, card: 640, hero: 1280, og: 1200 } as const;

export async function processMedia(imageId: string, progress: (value:number) => Promise<unknown> = async () => {}) {
  const image = await db.eventImage.findUnique({ where: { id: imageId } });
  if (!image || image.variants) return;
  try {
    const original = await storage.read(image.storageKey, MAX_IMAGE_BYTES);
    const detected = await fileTypeFromBuffer(original);
    if (!detected || !allowed.has(detected.ext))
      throw new Error("The upload is not a supported image.");
    let input =
      detected.ext === "heic" || detected.ext === "heif"
        ? Buffer.from(
            await heicConvert({
              buffer: original,
              format: "JPEG",
              quality: 0.95,
            }),
          )
        : original;
    const metadata = await sharp(input).metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > 80_000_000
    )
      throw new Error("Image dimensions are invalid or too large.");
    if (image.crop) {
      const rotated = await sharp(input).rotate().toBuffer({resolveWithObject:true});
      input = await sharp(rotated.data).extract(cropRegion(rotated.info.width,rotated.info.height,cropSchema.parse(image.crop))).toBuffer();
    }
    const { data: raw, info } = await sharp(input)
      .rotate()
      .resize(32, 32, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const blurhash = encode(
      new Uint8ClampedArray(raw),
      info.width,
      info.height,
      4,
      3,
    );
    const variants: Record<string, Record<string, string>> = {};
    const revision = (image.crop as {revision?:string} | null)?.revision;
    const base = image.storageKey.replace("/original/", "/variants/") + (revision ? `/${revision}` : "");
    let completed = 0;
    for (const [size, width] of Object.entries(sizes)) {
      variants[size] = {};
      for (const format of ["avif", "webp", "jpeg"] as const) {
        const transform = sharp(input)
          .rotate()
          .resize(width, size === "og" ? 630 : undefined, {
            fit: size === "og" ? "cover" : "inside",
            withoutEnlargement: size !== "og",
          });
        const output = await transform
          .toFormat(format, { quality: format === "jpeg" ? 82 : 72 })
          .toBuffer();
        const key = `${base}/${size}.${format === "jpeg" ? "jpg" : format}`;
        await storage.write(key, output, `image/${format}`);
        variants[size][format] = storage.publicUrl(key);
        await progress(Math.round(++completed / 12 * 100));
      }
    }
    await db.eventImage.updateMany({
      where: { id: imageId, crop:{equals:image.crop ?? Prisma.DbNull} },
      data: {
        variants,
        width: metadata.width,
        height: metadata.height,
        blurhash,
        mime: detected.mime,
        processingError: null,
      },
    });
  } catch (error) {
    await db.eventImage.updateMany({
      where: { id: imageId, crop:{equals:image.crop ?? Prisma.DbNull} },
      data: {
        processingError:
          error instanceof Error ? error.message : "Image processing failed.",
      },
    });
    throw error;
  }
}
