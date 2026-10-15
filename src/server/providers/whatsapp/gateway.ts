import {
  gatewayMessageSchema,
  WaError,
  type GatewayMessage,
  type SendResult,
  waErrorCodes,
} from "@raunak/wa-contracts";
import { z } from "zod";
import type { WhatsAppMediaProvider } from "./provider";

export async function gatewayRequest<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  const config = z
    .object({ WA_GATEWAY_URL: z.url(), WA_GATEWAY_API_KEY: z.string().min(32) })
    .parse(process.env);
  const response = await fetch(new URL(path, config.WA_GATEWAY_URL), {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${config.WA_GATEWAY_API_KEY}`,
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(55000),
  });
  const result = await response.json();
  if (!response.ok) {
    const failure = z
      .object({
        errorCode: z.enum(waErrorCodes),
        retryable: z.boolean(),
        retryAfterMs: z.number().nonnegative(),
      })
      .safeParse(result);
    if (failure.success)
      throw new WaError(
        failure.data.errorCode,
        failure.data.retryable,
        failure.data.retryAfterMs,
      );
    throw new WaError("ENGINE_ERROR", false);
  }
  return result as T;
}
export class BaileysGatewayProvider implements WhatsAppMediaProvider {
  async send(sessionId: string, message: GatewayMessage): Promise<SendResult> {
    if (process.env.WA_UNOFFICIAL_ENABLED !== "true")
      throw new WaError("KILL_SWITCH");
    const result = await gatewayRequest(
      `/v1/sessions/${sessionId}/messages`,
      gatewayMessageSchema.parse(message),
    );
    return z
      .object({
        providerMessageId: z.string().min(1),
        messageIds: z.array(z.string().min(1)).optional(),
      })
      .parse(result);
  }
  async sendImage(sessionId: string, message: GatewayMessage, image: Buffer) {
    return this.send(sessionId, {
      ...message,
      attachments: [
        {
          kind: "image",
          mimetype: "image/png",
          content: image.toString("base64"),
        },
      ],
    });
  }
  async sendDocument(
    sessionId: string,
    message: GatewayMessage,
    document: Buffer,
    filename: string,
  ) {
    return this.send(sessionId, {
      ...message,
      attachments: [
        {
          kind: "document",
          mimetype: "application/pdf",
          content: document.toString("base64"),
          filename,
        },
      ],
    });
  }
}
