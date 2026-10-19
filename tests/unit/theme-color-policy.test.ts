import { expect, it } from "vitest";
import { themeColorViolations } from "../../scripts/check-theme-colors";

it("reports literal colors and palette utilities with source lines", () => {
  const failures = themeColorViolations("src/components/example.tsx", 'color: "#fff";\nclassName="dark:text-zinc-700 bg-white"\nbackground: rgba(0,0,0,.2);\nfill="black"');
  expect(failures.map(({ line }) => line)).toEqual([1, 2, 2, 3, 4]);
});

it("allows semantic tokens, anchors, geometry, currentColor and transparent", () => {
  expect(themeColorViolations("src/app/example.css", 'color: var(--text); fill: currentColor; background: transparent;\na[href="#features"] { width: 1440px; }')).toEqual([]);
});

it("limits fixed-palette exceptions to tokens, artwork and exact browser metadata", () => {
  expect(themeColorViolations("src/app/theme-tokens.css", "--text: #14120f;")).toEqual([]);
  expect(themeColorViolations("src/app/opengraph-image.tsx", 'color: "#fff"')).toEqual([]);
  expect(themeColorViolations("src/app/layout.tsx", '    { media: "(prefers-color-scheme: dark)", color: "#0f0e0c" },')).toEqual([]);
  expect(themeColorViolations("src/app/layout.tsx", 'color: "#fff"')).toHaveLength(1);
});
