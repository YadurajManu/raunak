import sharp from "sharp";
import { BinaryBitmap, HybridBinarizer, RGBLuminanceSource, QRCodeReader } from "@zxing/library";
export async function decodeCard(buffer: Buffer) {
  const { data, info } = await sharp(buffer).flatten({ background: "#fff" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  return new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(new Uint8ClampedArray(data), info.width, info.height)))).getText();
}
