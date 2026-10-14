import { Queue } from "bullmq";
import IORedis from "ioredis";

export const mediaConnection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null },
);
export const producerConnection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: 1, connectTimeout: 3000 },
);
export const mediaQueue = new Queue<{ imageId: string }>("media", {
  connection: producerConnection,
});

export const orderQueue = new Queue("orders", {
  connection: producerConnection,
});

export const ticketQueue = new Queue<{ orderId: string }>("tickets", {
  connection: producerConnection,
});

export const notificationQueue = new Queue<{ id: string }>("notifications", {
  connection: producerConnection,
});
