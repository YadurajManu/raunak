export function imageFileError(file: {
  name: string;
  type: string;
  size: number;
}) {
  if (file.size <= 0) return "This file is empty.";
  if (file.size > 10 * 1024 * 1024)
    return "Choose an image smaller than 10 MB.";
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "image/gif",
      "image/heic",
      "image/heif",
    ].includes(file.type) &&
    !(!file.type && /\.hei[cf]$/i.test(file.name))
  )
    return "Use JPEG, PNG, WebP, AVIF, GIF or HEIC images.";
  return "";
}
