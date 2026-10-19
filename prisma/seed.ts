import "dotenv/config";
import { createRequire } from "node:module";

// Keep the historical entry point on the same safe, dry-run-by-default seeder.
const { run, options } = createRequire(import.meta.url)(
  "../seed-raunak-events.js",
);
Promise.resolve()
  .then(() => run(options()))
  .catch((error: Error & { code?: string }) => {
    console.error(
      `Seed failed: ${error.code ? `database error ${error.code}; transaction rolled back` : error.message}`,
    );
    process.exitCode = 1;
  });
