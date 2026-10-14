import { Queue } from "bullmq";
import IORedis from "ioredis";

export const mediaConnection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null },
);
export const mediaQueue = new Queue<{ imageId: string }>("media", {
  connection: mediaConnection,
});

export const orderQueue = new Queue("orders", { connection: mediaConnection });
