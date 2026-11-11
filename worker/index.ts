import "dotenv/config";
import { APP_NAME } from "../src/lib/constants";
import { Worker, DelayedError } from "bullmq";
import { WaError } from "@raunak/wa-contracts";
import { mediaConnection, orderQueue } from "./queues";
import {
  fulfilOrder,
  maintainNotifications,
} from "../src/server/notifications/maintenance";
import { processNotification } from "../src/server/notifications/service";
import { expireOrders } from "../src/server/checkout/service";

async function main() {
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
    async (job, token) => {
      try {
        await processNotification(job.data.id);
      } catch (error) {
        if (
          error instanceof WaError &&
          error.retryable &&
          ["WA_CAP_REACHED", "QUIET_HOURS"].includes(error.code)
        ) {
          await job.moveToDelayed(
            Date.now() + Math.max(1000, error.retryAfterMs),
            token,
          );
          throw new DelayedError();
        }
        throw error;
      }
    },
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
  console.log(`${APP_NAME} workers ready`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
