import { afterEach, expect, it, vi } from "vitest";
import { storage } from "../../src/server/providers/storage/s3";
afterEach(() => vi.unstubAllEnvs());
it("presigns browser uploads without a checksum calculated for an empty body", async () => {
  for (const [key, value] of Object.entries({
    S3_ENDPOINT: "https://storage.example",
    S3_REGION: "garage",
    S3_BUCKET: "test",
    S3_ACCESS_KEY_ID: "test",
    S3_SECRET_ACCESS_KEY: "test",
    S3_PUBLIC_BASE_URL: "https://app.example/api/media",
    AWS_REQUEST_CHECKSUM_CALCULATION: "WHEN_REQUIRED",
  }))
    vi.stubEnv(key, value);
  const url = new URL(await storage.presignPut("original/test", "image/webp"));
  expect(url.searchParams.has("x-amz-checksum-crc32")).toBe(false);
  expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
});
