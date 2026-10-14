import "dotenv/config";
import { APP_NAME } from "../src/lib/constants";
import { Worker } from "bullmq";
import { db } from "../src/server/db/client";
import { Prisma } from "../src/generated/prisma/client";
import { mediaConnection, mediaQueue, orderQueue } from "./queues";
import { processMedia } from "./jobs/process-media";
import { expireOrders } from "../src/server/checkout/service";

async function main() {
  const pending = await db.eventImage.findMany({
    where: { variants: { equals: Prisma.DbNull }, processingError: null },
    select: { id: true },
  });
  for (const image of pending)
    await mediaQueue.add(
      "process",
      { imageId: image.id },
      {
        jobId: image.id,
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
      },
    );
  const worker = new Worker<{ imageId: string }>(
    "media",
    (job) => processMedia(job.data.imageId),
    { connection: mediaConnection, concurrency: 2 },
  );
  await orderQueue.upsertJobScheduler(
    "expire-orders",
    { every: 60_000 },
    { name: "expire-orders", data: {}, opts: { removeOnComplete: 100 } },
  );
  const orderWorker = new Worker(
    "orders",
    async (job) => {
      if (job.name === "expire-orders") await expireOrders();
    },
    { connection: mediaConnection },
  );
  orderWorker.on("failed", (job, error) =>
    console.error(`Order job ${job?.id} failed: ${error.message}`),
  );
  worker.on("failed", (job, error) =>
    console.error(`Media job ${job?.id} failed: ${error.message}`),
  );
  console.log(`${APP_NAME} workers ready`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
