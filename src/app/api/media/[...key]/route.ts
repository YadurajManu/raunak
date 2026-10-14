import { presignMediaRead } from "@/server/providers/storage/s3";

// Only processed event artwork is public; originals and ticket files stay private.
const publicVariant =
  /^orgs\/[0-9a-f-]{36}\/events\/[0-9a-f-]{36}\/variants\/[0-9a-f-]{36}\/(thumb|card|hero|og)\.(avif|webp|jpg)$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const key = (await params).key.join("/");
  if (!publicVariant.test(key))
    return new Response("Not found", { status: 404 });
  try {
    return Response.redirect(await presignMediaRead(key), 307);
  } catch {
    return new Response("Media temporarily unavailable", { status: 503 });
  }
}
