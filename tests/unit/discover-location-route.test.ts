import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sameOrigin: vi.fn(),
  lookupCity: vi.fn(),
}));

vi.mock("@/server/auth/origin", () => ({
  requireSameOrigin: mocks.sameOrigin,
}));
vi.mock("@/server/location/service", () => ({
  lookupPublicCity: mocks.lookupCity,
}));

import { POST } from "@/app/api/discover/location/route";

beforeEach(() => {
  mocks.sameOrigin.mockReset();
  mocks.lookupCity.mockReset();
});

it("returns only the detected city for a same-origin nearby lookup", async () => {
  mocks.lookupCity.mockResolvedValue("Greater Noida");
  const request = new Request("https://raunak.example/api/discover/location", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://raunak.example",
      "cf-connecting-ip": "203.0.113.5",
    },
    body: JSON.stringify({
      kind: "reverse",
      latitude: 28.47,
      longitude: 77.5,
    }),
  });

  const response = await POST(request);

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ city: "Greater Noida" });
  expect(mocks.sameOrigin).toHaveBeenCalledWith(request);
  expect(mocks.lookupCity).toHaveBeenCalledWith(
    { kind: "reverse", latitude: 28.47, longitude: 77.5 },
    "203.0.113.5",
  );
});

it("returns a rate-limit response when nearby lookups are throttled", async () => {
  mocks.lookupCity.mockRejectedValue(new Error("Too many location requests."));
  const request = new Request("https://raunak.example/api/discover/location", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "reverse",
      latitude: 28.47,
      longitude: 77.5,
    }),
  });

  const response = await POST(request);

  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({
    error: "Too many location requests.",
  });
});
