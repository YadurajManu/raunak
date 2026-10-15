import { EventEmitter } from "node:events";
import makeWASocket, { DisconnectReason, jidDecode, WAMessageStatus, type WASocket, type AnyMessageContent } from "baileys";
import type { ILogger } from "baileys/lib/Utils/logger.js";
import { WaError, type EngineEvent, type SessionRecord, type WhatsAppEngine } from "@raunak/wa-contracts";
import { db } from "@/server/db/client";
import { postgresAuth } from "./auth-state";

const silent: ILogger = { level: "silent", child() { return this; }, trace() {}, debug() {}, info() {}, warn() {}, error() {} };
export function disconnectAction(code?: number) {
  if (code === DisconnectReason.loggedOut) return "LOGGED_OUT";
  if (code === DisconnectReason.connectionReplaced) return "PAUSED";
  if (code === DisconnectReason.forbidden) return "BANNED_SUSPECTED";
  if (code === DisconnectReason.badSession || code === DisconnectReason.multideviceMismatch) return "DISCONNECTED";
  return "RECONNECT";
}
function phone(jid?: string | null) {
  const decoded = jid ? jidDecode(jid) : null;
  if (!decoded || !["s.whatsapp.net", "c.us"].includes(decoded.server) || !/^[1-9]\d{7,14}$/.test(decoded.user)) return null;
  return `+${decoded.user}`;
}
type Connection = { socket: WASocket; auth: Awaited<ReturnType<typeof postgresAuth>>; ready: boolean; stopped: boolean; retries: number; timer?: ReturnType<typeof setTimeout> };
export class BaileysEngine implements WhatsAppEngine {
  private events = new EventEmitter();
  private connections = new Map<string, Connection>();
  constructor(private assertOwned: (id: string) => Promise<void>, private secret: string) {}
  on(type: EngineEvent["type"], handler: (event: EngineEvent) => void) { this.events.on(type, handler); }
  private emit(event: EngineEvent) { this.events.emit(event.type, event); }
  async start(session: SessionRecord) {
    if (this.connections.has(session.id)) return;
    await this.open(session, 0);
  }
  private async open(session: SessionRecord, retries: number) {
    await this.assertOwned(session.id);
    const auth = await postgresAuth(session, () => this.assertOwned(session.id), this.secret);
    const socket = makeWASocket({ auth: auth.state, logger: silent, syncFullHistory: false, markOnlineOnConnect: false, shouldSyncHistoryMessage: () => false, getMessage: async () => undefined });
    const connection: Connection = { socket, auth, ready: false, stopped: false, retries };
    this.connections.set(session.id, connection);
    auth.onError(() => { void this.stop(session.id).finally(() => this.emit({ type: "status", sessionId: session.id, status: "PAUSED", reason: "AUTH_PERSIST_FAILED" })); });
    socket.ev.on("creds.update", update => auth.update(update));
    socket.ev.on("connection.update", update => {
      void (async () => {
        if (connection.stopped) return;
        if (update.qr) { connection.ready = true; this.emit({ type: "qr", sessionId: session.id, qr: update.qr }); }
        if (update.connection === "connecting") this.emit({ type: "status", sessionId: session.id, status: "CONNECTING" });
        if (update.connection === "open") {
          connection.ready = true; connection.retries = 0; await auth.flush();
          this.emit({ type: "status", sessionId: session.id, status: "CONNECTED", phoneE164: phone(socket.user?.id) || undefined, pushName: socket.user?.name });
        }
        if (update.connection !== "close") return;
        connection.ready = false;
        const error = update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined;
        const action = disconnectAction(error?.output?.statusCode);
        if (action !== "RECONNECT") {
          connection.stopped = true; await auth.close(action === "LOGGED_OUT").catch(() => {});
          await socket.end(undefined); this.connections.delete(session.id);
          this.emit({ type: "status", sessionId: session.id, status: action, reason: action === "DISCONNECTED" ? "BAD_SESSION" : action === "PAUSED" ? "CONNECTION_REPLACED" : action });
          return;
        }
        await auth.close();
        this.emit({ type: "status", sessionId: session.id, status: "CONNECTING", reason: "RECONNECTING" });
        const delay = Math.min(300000, 1000 * 2 ** Math.min(connection.retries, 9)) + Math.random() * 1000;
        connection.timer = setTimeout(() => {
          void (async () => {
            if (connection.stopped) return;
            const current = await db.whatsAppSession.findUniqueOrThrow({ where: { id: session.id } });
            await this.open(current, connection.retries + 1);
          })().catch(() => this.emit({ type: "status", sessionId: session.id, status: "PAUSED", reason: "RECONNECT_FAILED" }));
        }, delay);
        connection.timer.unref();
      })().catch(() => { void this.stop(session.id).finally(() => this.emit({ type: "status", sessionId: session.id, status: "PAUSED", reason: "ENGINE_ERROR" })); });
    });
    socket.ev.on("messages.update", updates => {
      for (const { key, update } of updates) {
        if (!key.fromMe || !key.id || update.status == null) continue;
        const status = update.status >= WAMessageStatus.READ ? "READ" : update.status >= WAMessageStatus.DELIVERY_ACK ? "DELIVERED" : update.status >= WAMessageStatus.SERVER_ACK ? "SENT" : null;
        if (status) this.emit({ type: "receipt", sessionId: session.id, messageId: key.id, status });
      }
    });
    socket.ev.on("message-receipt.update", updates => {
      for (const { key, receipt } of updates) if (key.fromMe && key.id) {
        const status = receipt.readTimestamp || receipt.playedTimestamp ? "READ" : receipt.receiptTimestamp ? "DELIVERED" : null;
        if (status) this.emit({ type: "receipt", sessionId: session.id, messageId: key.id, status });
      }
    });
    socket.ev.on("messages.upsert", ({ messages, type }) => {
      if (type !== "notify") return;
      for (const message of messages) void (async () => {
        const key = message.key, jid = key.remoteJid;
        if (key.fromMe || !key.id || !jid || jid.endsWith("@g.us") || jid.endsWith("@broadcast") || jid.endsWith("@newsletter")) return;
        let sender = phone(key.remoteJidAlt) || phone(jid);
        if (!sender && jid.endsWith("@lid")) sender = phone(await socket.signalRepository.lidMapping.getPNForLID(jid));
        if (!sender) return;
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        if (text && text.length <= 12000) this.emit({ type: "inbound", sessionId: session.id, messageId: key.id, phoneE164: sender, text });
      })().catch(() => {});
    });
  }
  async stop(id: string) {
    const connection = this.connections.get(id); if (!connection) return;
    connection.stopped = true;
    if (connection.timer) clearTimeout(connection.timer);
    this.connections.delete(id);
    await connection.socket.end(undefined);
    await connection.auth.close().catch(() => {});
  }
  private async socket(id: string) {
    await this.assertOwned(id);
    const connection = this.connections.get(id);
    if (!connection?.ready || connection.stopped) throw new WaError("SESSION_DISCONNECTED");
    return connection.socket;
  }
  async requestPairingCode(id: string, number: string) {
    const socket = await this.socket(id);
    if (socket.authState.creds.registered) throw new WaError("SESSION_PAUSED");
    return socket.requestPairingCode(number.replace(/^\+/, ""));
  }
  async isOnWhatsApp(id: string, number: string) { return !!(await (await this.socket(id)).onWhatsApp(number.replace(/^\+/, "")))?.[0]?.exists; }
  async presence(id: string, to: string, kind: "composing" | "paused") { await (await this.socket(id)).sendPresenceUpdate(kind, `${to.slice(1)}@s.whatsapp.net`); }
  private async send(id: string, to: string, content: AnyMessageContent) {
    const message = await (await this.socket(id)).sendMessage(`${to.slice(1)}@s.whatsapp.net`, content);
    if (!message?.key.id) throw new WaError("ENGINE_ERROR");
    return { providerMessageId: message.key.id };
  }
  async sendText(id: string, to: string, text: string) { return this.send(id, to, { text }); }
  async sendImage(id: string, to: string, image: Buffer, caption = "") { return this.send(id, to, { image, caption }); }
  async sendDocument(id: string, to: string, document: Buffer, fileName: string, mimetype: string, caption = "") { return this.send(id, to, { document, fileName, mimetype, caption }); }
}
