import { describe, expect, it } from "vitest";
import { APP_NAME } from "../../src/lib/constants";

describe("application configuration", () => {
  it("keeps the brand name in one constant", () => {
    expect(APP_NAME).toBe("Raunak");
  });
});
