import "dotenv/config";
import { Worker } from "bullmq";
import { db } from "../src/server/db/client";
import { mediaConnection, mediaQueue } from "./queues";
import { processMedia } from "./jobs/process-media";

async function main() {
  const pending = await db.$queryRaw<
    { id: string; crop: { revision?: string } | null }[]
  >`
    SELECT id, crop FROM "EventImage"
    WHERE "processingError" IS NULL AND (variants->'og'->>'avif') IS NULL
      AND "storageKey" LIKE 'orgs/%/events/%/original/%'
  `;
  for (const image of pending)
    await mediaQueue.add(
      "process",
      { imageId: image.id },
      {
        jobId: (image.crop as { revision?: string } | null)?.revision
          ? `${image.id}-${(image.crop as { revision: string }).revision}`
          : image.id,
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
      },
    );
  const worker = new Worker<{ imageId: string }>(
    "media",
    (job) =>
      processMedia(job.data.imageId, (value) => job.updateProgress(value)),
    { connection: mediaConnection, concurrency: 2 },
  );
  worker.on("failed", (job, error) =>
    console.error(`Media job ${job?.id} failed: ${error.message}`),
  );
  console.log("Raunak media worker ready");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
