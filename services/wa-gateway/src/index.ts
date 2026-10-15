import "dotenv/config";
import Redis from "ioredis";
import { z } from "zod";
import { db } from "@/server/db/client";
import { MockEngine } from "./engines/mock";
import { BaileysEngine } from "./engines/baileys";
import { GatewayRuntime } from "./runtime";
import { gatewayServer } from "./http";

const config = z.object({ WA_GATEWAY_ENGINE: z.enum(["mock", "baileys"]).default("baileys"), WA_GATEWAY_API_KEY: z.string().min(32), ENCRYPTION_KEY: z.string().min(32), REDIS_URL: z.string().min(1), WA_GATEWAY_HOST: z.string().default("127.0.0.1"), WA_GATEWAY_PORT: z.coerce.number().int().min(1).max(65535).default(3101) }).parse(process.env);
const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 1 });
const runtime: GatewayRuntime = new GatewayRuntime(redis, config.WA_GATEWAY_ENGINE === "mock" ? new MockEngine() : new BaileysEngine(id => runtime.assertOwned(id), config.ENCRYPTION_KEY));
const server = gatewayServer(runtime, config.WA_GATEWAY_API_KEY);
server.listen(config.WA_GATEWAY_PORT, config.WA_GATEWAY_HOST, () => console.info(JSON.stringify({ event: "wa.gateway.started", engine: config.WA_GATEWAY_ENGINE })));
await runtime.boot();
const inboundTimer = setInterval(() => { void runtime.drainInbound().catch(() => console.error(JSON.stringify({ event: "wa.inbound.failed", code: "ENGINE_ERROR" }))); }, 15000);
inboundTimer.unref();
async function shutdown() { clearInterval(inboundTimer); server.close(); await runtime.close(); await redis.quit(); await db.$disconnect(); }
process.once("SIGTERM", () => { void shutdown(); });
process.once("SIGINT", () => { void shutdown(); });
