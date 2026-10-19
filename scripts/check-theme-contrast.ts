import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Palette = Record<string, string>;
const source = readFileSync(resolve("src/app/theme-tokens.css"), "utf8");

function cssBlock(selector: string): string {
  const start = source.indexOf(selector);
  if (start < 0) throw new Error(`Missing theme block: ${selector}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`Unclosed theme block: ${selector}`);
}

function palette(block: string): Palette {
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2].trim(),
    ]),
  );
}

function resolveToken(tokens: Palette, name: string, depth = 0): string {
  if (depth > 5 || !tokens[name]) throw new Error(`Missing token ${name}`);
  return tokens[name].replace(/var\((--[\w-]+)\)/g, (_, ref: string) =>
    resolveToken(tokens, ref, depth + 1),
  );
}

function luminance(hex: string): number {
  const normalized = hex.replace("#", "");
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(normalized))
    throw new Error(`Expected an opaque hex token, got ${hex}`);
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((value) => value + value)
          .join("")
      : normalized;
  const [r, g, b] = [0, 2, 4].map((index) =>
    Number.parseInt(expanded.slice(index, index + 2), 16) / 255,
  );
  const linear = (value: number) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const pairs = [
  ["text", "bg", 4.5],
  ["text", "surface", 4.5],
  ["text", "surface-raised", 4.5],
  ["text-muted", "bg", 4.5],
  ["text-muted", "surface", 4.5],
  ["text-subtle", "bg", 4.5],
  ["accent-text", "bg", 4.5],
  ["accent-text", "surface", 4.5],
  ["on-accent", "accent", 4.5],
  ["chip-selected-fg", "chip-selected-bg", 4.5],
  ["success", "bg", 4.5],
  ["success-fg", "success-bg", 4.5],
  ["warning-fg", "warning-bg", 4.5],
  ["danger-fg", "danger-bg", 4.5],
  ["border", "bg", 3],
  ["border", "surface", 3],
  ["border-strong", "bg", 3],
  ["focus-ring", "bg", 3],
] as const;

export function auditThemeTokens() {
  const light = palette(cssBlock(":root {"));
  const themes = [
    ["light", light],
    ["dark", { ...light, ...palette(cssBlock(':root[data-marketing-theme="dark"]')) }],
  ] as const;
  return themes.flatMap(([theme, tokens]) =>
    pairs.map(([foreground, background, minimum]) => {
      const fg = resolveToken(tokens, `--${foreground}`);
      const bg = resolveToken(tokens, `--${background}`);
      const ratio = contrastRatio(fg, bg);
      return { theme, foreground, background, ratio, minimum, passes: ratio >= minimum };
    }),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results = auditThemeTokens();
  console.table(
    results.map(({ theme, foreground, background, ratio, minimum, passes }) => ({
      theme,
      pair: `${foreground}/${background}`,
      ratio: `${ratio.toFixed(2)}:1`,
      required: `${minimum}:1`,
      result: passes ? "PASS" : "FAIL",
    })),
  );
  const failures = results.filter((result) => !result.passes);
  if (failures.length) process.exitCode = 1;
}
