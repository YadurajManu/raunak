import { WaError } from "@raunak/wa-contracts";

type Entry = { priority: number; run: () => Promise<void> };
export class SessionQueue {
  private queues = new Map<string, Entry[]>();
  private running = new Set<string>();
  enqueue<T>(id: string, priority: number, task: () => Promise<T>): Promise<T> {
    const queue = this.queues.get(id) || [];
    if (queue.length >= 32) return Promise.reject(new WaError("RATE_LIMITED", true, 30000));
    this.queues.set(id, queue);
    return new Promise<T>((resolve, reject) => {
      queue.push({ priority, run: async () => { try { resolve(await task()); } catch (error) { reject(error); } } });
      queue.sort((a, b) => a.priority - b.priority);
      if (!this.running.has(id)) void this.drain(id);
    });
  }
  private async drain(id: string) {
    this.running.add(id);
    try { let entry; while ((entry = this.queues.get(id)?.shift())) await entry.run(); }
    finally { this.running.delete(id); this.queues.delete(id); }
  }
}
