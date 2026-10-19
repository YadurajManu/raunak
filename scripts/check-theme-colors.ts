import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const literalPatterns = [
  /#[\da-f]{8}\b|#[\da-f]{6}\b|#[\da-f]{4}\b|#[\da-f]{3}\b/gi,
  /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/gi,
  /\b(?:text|bg|border|ring|outline|fill|stroke|shadow|from|via|to|divide|decoration|placeholder|accent|caret)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/g,
  /(?:\b(?:color|background(?:-color)?|border(?:-color)?|fill|stroke)\s*[:=]\s*["']?|\b(?:box-shadow|text-shadow)\s*:[^;]*?\s)(?:white|black|red|green|blue|gray|grey|orange|yellow|purple|pink|navy|teal|cyan|magenta)\b/gi,
];

export function themeColorViolations(file: string, source: string) {
  const path = file.replaceAll("\\", "/");
  // Exported artwork has a fixed palette; server email/PDF artwork is outside web scopes.
  if (path === "src/app/theme-tokens.css" || /(?:^|\/)opengraph-image\.tsx$/.test(path)) return [];
  const failures: { file: string; line: number; value: string }[] = [];
  source.split("\n").forEach((line, index) => {
    if (path === "src/app/layout.tsx" && /^\s*\{ media: "\(prefers-color-scheme: (?:light|dark)\)", color: "#[\da-f]{6}" \},\s*$/i.test(line)) return;
    if (/^\s*(?:\/\/|\/\*|\*|\*\/)/.test(line)) return;
    for (const pattern of literalPatterns) {
      for (const match of line.matchAll(pattern)) failures.push({ file: path, line: index + 1, value: match[0] });
    }
  });
  return failures;
}

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : /\.(?:css|tsx|ts)$/.test(path) ? [path] : [];
  });
}

export function checkThemeColors(root = process.cwd()) {
  return ["src/app", "src/components", "src/lib/motion"].flatMap((scope) =>
    files(join(root, scope)).flatMap((file) => themeColorViolations(relative(root, file), readFileSync(file, "utf8"))),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failures = checkThemeColors();
  for (const failure of failures) console.error(`${failure.file}:${failure.line}: hardcoded color ${failure.value}`);
  if (failures.length) {
    console.error(`${failures.length} hardcoded colors. Use semantic variables from src/app/theme-tokens.css.`);
    process.exitCode = 1;
  } else console.log("Web theme color policy passed.");
}
