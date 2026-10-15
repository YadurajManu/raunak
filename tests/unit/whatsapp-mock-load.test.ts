import { expect, it } from "vitest";
import { SessionQueue } from "../../services/wa-gateway/src/queue";
import { MockEngine } from "../../services/wa-gateway/src/engines/mock";
it("processes 200 mock sends with 20 concurrent callers and never overlaps a session send", async () => {
  const queue = new SessionQueue(),
    engine = new MockEngine();
  engine.emit({ type: "status", sessionId: "load", status: "CONNECTED" });
  let active = 0,
    maximum = 0;
  for (let batch = 0; batch < 10; batch++)
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        queue.enqueue("load", i % 7, async () => {
          active++;
          maximum = Math.max(active, maximum);
          try {
            return await engine.sendText(
              "load",
              "+919876543210",
              `Test ${batch}:${i}`,
            );
          } finally {
            active--;
          }
        }),
      ),
    );
  expect(maximum).toBe(1);
  expect(engine.sent).toHaveLength(200);
});
