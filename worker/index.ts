import "dotenv/config";
import { APP_NAME } from "../src/lib/constants";
import { Worker } from "bullmq";
import { db } from "../src/server/db/client";
import { Prisma } from "../src/generated/prisma/client";
import { mediaConnection, mediaQueue, orderQueue } from "./queues";
import { processMedia } from "./jobs/process-media";
import {
  fulfilOrder,
  maintainNotifications,
} from "../src/server/notifications/maintenance";
import { processNotification } from "../src/server/notifications/service";
import { expireOrders } from "../src/server/checkout/service";

async function main() {
  const pending = await db.eventImage.findMany({
    where: { variants: { equals: Prisma.DbNull }, processingError: null },
    select: { id: true, crop:true },
  });
  for (const image of pending)
    await mediaQueue.add(
      "process",
      { imageId: image.id },
      {
        jobId: (image.crop as {revision?:string} | null)?.revision ? `${image.id}-${(image.crop as {revision:string}).revision}` : image.id,
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
      },
    );
  const worker = new Worker<{ imageId: string }>(
    "media",
    (job) => processMedia(job.data.imageId, value => job.updateProgress(value)),
    { connection: mediaConnection, concurrency: 2 },
  );
  await orderQueue.upsertJobScheduler(
    "expire-orders",
    { every: 60_000 },
    { name: "expire-orders", data: {}, opts: { removeOnComplete: 100 } },
  );
  const ticketWorker = new Worker<{ orderId: string }>(
    "tickets",
    (job) => fulfilOrder(job.data.orderId),
    { connection: mediaConnection, concurrency: 1 },
  );
  ticketWorker.on("failed", () =>
    console.error("Ticket preparation failed; see the order delivery status."),
  );
  const notificationWorker = new Worker<{ id: string }>(
    "notifications",
    (job) => processNotification(job.data.id),
    { connection: mediaConnection, concurrency: 2 },
  );
  notificationWorker.on("failed", () =>
    console.error("Notification delivery failed; see the delivery log."),
  );
  const orderWorker = new Worker(
    "orders",
    async (job) => {
      if (job.name === "expire-orders") {
        await expireOrders();
        await maintainNotifications();
      }
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
