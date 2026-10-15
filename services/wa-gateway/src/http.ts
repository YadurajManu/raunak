import { createServer, type IncomingMessage } from "node:http";
import { z } from "zod";
import { WaError, gatewayMessageSchema } from "@raunak/wa-contracts";
import { authorize } from "./security";
import type { GatewayRuntime } from "./runtime";

async function body(request: IncomingMessage) {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; if (size > 16 * 1024 * 1024) throw new WaError("MEDIA_TOO_LARGE"); chunks.push(Buffer.from(chunk)); }
  return JSON.parse(Buffer.concat(chunks).toString() || "{}");
}
export function gatewayServer(runtime: GatewayRuntime, key: string) {
  if (key.length < 32) throw new Error("WA_GATEWAY_API_KEY must have at least 32 characters.");
  const server = createServer(async (req, res) => {
    const reply = (status: number, data: unknown) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(data)); };
    if (!authorize(req.headers.authorization, key)) return reply(401, { errorCode: "UNAUTHORIZED" });
    try {
      const url = new URL(req.url || "/", "http://gateway"), method = req.method;
      if (url.pathname === "/healthz" && method === "GET") { await runtime.redis.ping(); return reply(200, { ok: true }); }
      if (url.pathname === "/v1/sessions" && method === "POST") {
        const data = z.object({ orgId: z.uuid(), userId: z.uuid() }).parse(await body(req));
        const session = await runtime.create(data.orgId, data.userId); return reply(201, { id: session.id });
      }
      const route = /^\/v1\/sessions\/([^/]+)(?:\/(connect|disconnect|pairing-code|messages))?$/.exec(url.pathname);
      if (!route) return reply(404, { errorCode: "NOT_FOUND" });
      const id = z.uuid().parse(route[1]), action = route[2];
      if (!action && method === "GET") return reply(200, await runtime.status(id, z.uuid().nullable().parse(url.searchParams.get("orgId"))));
      if (method !== "POST") return reply(405, { errorCode: "METHOD_NOT_ALLOWED" });
      const data = await body(req);
      if (action === "messages") return reply(200, await runtime.send(id, gatewayMessageSchema.parse(data)));
      const scope = z.object({ orgId: z.uuid().nullable() }).parse(data);
      if (action === "connect") { await runtime.connect(id, scope.orgId); return reply(200, { ok: true }); }
      if (action === "disconnect") { await runtime.disconnect(id, scope.orgId); return reply(200, { ok: true }); }
      if (action === "pairing-code") return reply(200, await runtime.pairing(id, scope.orgId, z.string().regex(/^\+[1-9]\d{7,14}$/).parse(data.phone)));
      return reply(404, { errorCode: "NOT_FOUND" });
    } catch (error) {
      if (error instanceof WaError) return reply(error.retryable ? 503 : 422, { errorCode: error.code, retryable: error.retryable, retryAfterMs: error.retryAfterMs });
      if (error instanceof z.ZodError || error instanceof SyntaxError) return reply(400, { errorCode: "INVALID_REQUEST" });
      return reply(500, { errorCode: "ENGINE_ERROR", retryable: true, retryAfterMs: 5000 });
    }
  });
  server.requestTimeout = 60000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000;
  return server;
}
