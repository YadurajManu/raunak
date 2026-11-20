import { afterEach, expect, it, vi } from "vitest";
import { requireSameOrigin } from "@/server/auth/origin";

afterEach(() => vi.unstubAllEnvs());

it("accepts only the configured browser origin for mutations", () => {
  vi.stubEnv("APP_URL", "https://raunak.example/");
  const request = (origin?: string) =>
    new Request("https://raunak.example/api/checkout", {
      method: "POST",
      headers: origin === undefined ? {} : { origin },
    });
  expect(() => requireSameOrigin(request("https://raunak.example"))).not.toThrow();
  for (const origin of [
    undefined,
    "null",
    "https://other.raunak.example",
    "http://raunak.example",
    "https://raunak.example:444",
    "https://raunak.example/path",
  ]) {
    expect(() => requireSameOrigin(request(origin))).toThrow(
      "Request origin is not allowed.",
    );
  }
});
