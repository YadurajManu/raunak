import { expect, it } from "vitest";
import { auditThemeTokens, contrastRatio } from "../../scripts/check-theme-contrast";

it("keeps semantic text, accent, status, border and focus pairs accessible in both themes", () => {
  const failures = auditThemeTokens().filter(({ passes }) => !passes);
  expect(failures).toEqual([]);
});

it("calculates the ink on Raunak vermilion above AA contrast", () => {
  expect(contrastRatio("#14120f", "#ff4b2b")).toBeGreaterThanOrEqual(4.5);
});
