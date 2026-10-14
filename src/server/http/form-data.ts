export async function boundedFormData(request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length") || 0) > maxBytes)
    throw new Error("Upload is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Choose a file to upload.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("Upload is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new Response(Buffer.concat(chunks), {
    headers: { "Content-Type": request.headers.get("content-type") || "" },
  }).formData();
}
