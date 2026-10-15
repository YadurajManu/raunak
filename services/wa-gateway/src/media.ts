import { WaError, type GatewayMessage } from "@raunak/wa-contracts";
export function decodeMedia(attachments: GatewayMessage["attachments"]) {
  if (attachments.length > 6) throw new WaError("MEDIA_TOO_LARGE");
  let total = 0;
  return attachments.map((attachment) => {
    if (
      !attachment.content.length ||
      attachment.content.length % 4 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(attachment.content)
    )
      throw new WaError("MEDIA_TOO_LARGE");
    const buffer = Buffer.from(attachment.content, "base64");
    total += buffer.length;
    const valid =
      attachment.kind === "document"
        ? attachment.mimetype === "application/pdf" &&
          buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))
        : attachment.mimetype === "image/png"
          ? buffer
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : attachment.mimetype === "image/jpeg" &&
            buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
    if (
      !valid ||
      buffer.length > (attachment.kind === "document" ? 10 : 1) * 1024 * 1024 ||
      total > 12 * 1024 * 1024
    )
      throw new WaError("MEDIA_TOO_LARGE");
    return { ...attachment, buffer };
  });
}
