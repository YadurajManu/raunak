import {beforeEach,expect,it,vi} from "vitest";
import {readFile} from "node:fs/promises";
const mocks=vi.hoisted(()=>({user:vi.fn(),access:vi.fn(),image:vi.fn(),read:vi.fn(),job:vi.fn()}));
vi.mock("@/server/auth/session",()=>({requireUser:mocks.user}));
vi.mock("@/server/rbac/access",()=>({requireEventAccessForUser:mocks.access}));
vi.mock("@/server/db/client",()=>({db:{eventImage:{findFirstOrThrow:mocks.image}}}));
vi.mock("@/server/providers/storage/s3",()=>({storage:{read:mocks.read}}));
vi.mock("@/server/media/service",()=>({updateImage:vi.fn(),deleteImage:vi.fn()}));
vi.mock("../../worker/queues",()=>({mediaQueue:{getJob:mocks.job}}));
import {GET} from "@/app/api/events/[eventId]/images/[imageId]/route";
const params=Promise.resolve({eventId:"11111111-1111-4111-8111-111111111111",imageId:"22222222-2222-4222-8222-222222222222"});
beforeEach(()=>{Object.values(mocks).forEach(mock=>mock.mockReset());mocks.user.mockResolvedValue({id:"owner"});mocks.access.mockResolvedValue({});mocks.image.mockResolvedValue({storageKey:"private/original",mime:"image/png"});});
it("keeps private previews behind event access checks",async()=>{
  mocks.access.mockRejectedValue(new Error("Denied"));
  expect((await GET(new Request("https://raunak.example/image?preview=1"),{params})).status).toBe(400);
  expect(mocks.read).not.toHaveBeenCalled();
});
it("rejects disguised SVG or unsupported files before preview rendering",async()=>{
  mocks.read.mockResolvedValue(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
  expect((await GET(new Request("https://raunak.example/image?preview=1"),{params})).status).toBe(400);
});
it("renders a private JPEG preview of valid artwork",async()=>{
  mocks.read.mockResolvedValue(await readFile("tests/fixtures/source.png"));
  const response=await GET(new Request("https://raunak.example/image?preview=1"),{params});
  expect(response.status).toBe(200);expect(response.headers.get("content-type")).toBe("image/jpeg");expect(response.headers.get("cache-control")).toBe("private, no-store");
});
