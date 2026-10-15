import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import type {
  EngineEvent,
  SessionRecord,
  WhatsAppEngine,
} from "@raunak/wa-contracts";
import { WaError } from "@raunak/wa-contracts";

export class MockEngine implements WhatsAppEngine {
  private events = new EventEmitter();
  readonly connected = new Set<string>();
  readonly sent: {
    sessionId: string;
    to: string;
    kind: string;
    text: string;
    bytes: number;
  }[] = [];
  readonly unavailable = new Set<string>();
  fail = false;
  delayMs = 0;
  on(type: EngineEvent["type"], handler: (event: EngineEvent) => void) {
    this.events.on(type, handler);
  }
  emit(event: EngineEvent) {
    if (event.type === "status") {
      if (event.status === "CONNECTED") this.connected.add(event.sessionId);
      else this.connected.delete(event.sessionId);
    }
    this.events.emit(event.type, event);
  }
  async start(session: SessionRecord) {
    this.emit({ type: "status", sessionId: session.id, status: "CONNECTING" });
    this.emit({
      type: "qr",
      sessionId: session.id,
      qr: `mock-link:${session.id}`,
    });
  }
  async stop(sessionId: string) {
    this.connected.delete(sessionId);
  }
  async requestPairingCode() {
    return "MOCK1234";
  }
  async isOnWhatsApp(_sessionId: string, to: string) {
    return !this.unavailable.has(to);
  }
  async presence() {}
  private async send(
    sessionId: string,
    to: string,
    kind: string,
    text: string,
    bytes = 0,
  ) {
    if (!this.connected.has(sessionId))
      throw new WaError("SESSION_DISCONNECTED");
    if (this.fail) throw new WaError("ENGINE_ERROR");
    if (this.delayMs)
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    this.sent.push({ sessionId, to, kind, text, bytes });
    const providerMessageId = `mock-${createHash("sha256").update(`${sessionId}:${this.sent.length}`).digest("hex").slice(0, 24)}`;
    queueMicrotask(() =>
      this.emit({
        type: "receipt",
        sessionId,
        messageId: providerMessageId,
        status: "DELIVERED",
      }),
    );
    return { providerMessageId };
  }
  async sendText(sessionId: string, to: string, text: string) {
    return this.send(sessionId, to, "text", text);
  }
  async sendImage(sessionId: string, to: string, image: Buffer, caption = "") {
    return this.send(sessionId, to, "image", caption, image.length);
  }
  async sendDocument(
    sessionId: string,
    to: string,
    file: Buffer,
    _filename: string,
    _mimetype: string,
    caption = "",
  ) {
    return this.send(sessionId, to, "document", caption, file.length);
  }
}
