import { z } from "zod";
import { db } from "@/server/db/client";
import { ticketQueue } from "../../../worker/queues";
export async function queueTicketDelivery(orderId: string) {
  z.uuid().parse(orderId);
  const job = await ticketQueue.getJob(`order-${orderId}`);
  if (job && (await job.getState()) === "failed")
    await job.retry("failed", { resetAttemptsMade: true });
  else if (!job)
    await ticketQueue.add(
      "prepare",
      { orderId },
      {
        jobId: `order-${orderId}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 500,
      },
    );
}
export async function resendTickets(userId: string, orderId: string) {
  z.uuid().parse(orderId);
  const order = await db.order.findFirst({
    where: { id: orderId, buyerId: userId, status: "PAID" },
  });
  if (!order) throw new Error("Order not found.");
  await queueTicketDelivery(orderId);
}
