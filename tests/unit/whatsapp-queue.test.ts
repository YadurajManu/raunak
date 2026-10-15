import { expect, it } from "vitest";
import { SessionQueue } from "../../services/wa-gateway/src/queue";
it("serializes each session, prioritizes waiting tickets, and keeps other sessions independent", async () => {
  const queue = new SessionQueue(), order: string[] = [];
  let release!: () => void;
  const first = queue.enqueue("one", 6, async () => { await new Promise<void>(resolve => { release = resolve; }); order.push("first"); });
  const reminder = queue.enqueue("one", 6, async () => { order.push("reminder"); });
  const ticket = queue.enqueue("one", 0, async () => { order.push("ticket"); });
  await queue.enqueue("two", 6, async () => { order.push("other"); });
  release(); await Promise.all([first, reminder, ticket]);
  expect(order).toEqual(["other", "first", "ticket", "reminder"]);
});
