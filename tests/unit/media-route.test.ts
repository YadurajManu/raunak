import { beforeEach, expect, it, vi } from "vitest";
const { sign } = vi.hoisted(() => ({ sign: vi.fn() }));
vi.mock("@/server/providers/storage/s3", () => ({ presignMediaRead: sign }));
import { GET } from "../../src/app/api/media/[...key]/route";
beforeEach(() => sign.mockReset());
const prefix =
  "orgs/11111111-1111-4111-8111-111111111111/events/22222222-2222-4222-8222-222222222222";
it("signs processed artwork without exposing original uploads", async () => {
  sign.mockResolvedValue("https://storage.example/signed");
  const key = `${prefix}/variants/33333333-3333-4333-8333-333333333333/card.webp`;
  const r = await GET(new Request("https://raunak.example"), {
    params: Promise.resolve({ key: key.split("/") }),
  });
  expect(r.status).toBe(307);
  expect(sign).toHaveBeenCalledWith(key);
});
it.each([
  `${prefix}/original/33333333-3333-4333-8333-333333333333`,
  "tickets/private.pdf",
  `${prefix}/variants/../../secret`,
])("denies private or invalid keys: %s", async (key) => {
  expect(
    (
      await GET(new Request("https://raunak.example"), {
        params: Promise.resolve({ key: key.split("/") }),
      })
    ).status,
  ).toBe(404);
  expect(sign).not.toHaveBeenCalled();
});
