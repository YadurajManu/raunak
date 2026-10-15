import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import type { GatewayMessage, SendResult } from "@raunak/wa-contracts";
export interface WhatsAppMediaProvider {
  send(sessionId: string, message: GatewayMessage): Promise<SendResult>;
  sendImage(sessionId: string, message: GatewayMessage, image: Buffer): Promise<SendResult>;
  sendDocument(sessionId: string, message: GatewayMessage, document: Buffer, filename: string): Promise<SendResult>;
}
export interface WhatsAppProvider extends Partial<WhatsAppMediaProvider> {
  sendTemplate(input: {
    to: string;
    templateName: string;
    language: string;
    params: string[];
    notificationId: string;
    document?: { filename: string; content: Buffer };
  }): Promise<{ providerMessageId: string }>;
}
export const whatsapp: WhatsAppProvider = {
  async sendTemplate(input) {
    const phone = parsePhoneNumberFromString(input.to, "IN");
    if (!phone?.isValid())
      throw new Error("A valid recipient phone number is required.");
    const env = z
      .object({
        WHATSAPP_CLOUD_TOKEN: z.string().min(1),
        WHATSAPP_PHONE_NUMBER_ID: z.string().regex(/^\d+$/),
        WHATSAPP_API_VERSION: z.string().regex(/^v\d+\.\d+$/),
      })
      .safeParse(process.env);
    if (!env.success)
      throw new Error("WhatsApp sender credentials are not configured.");
    const components: object[] = [];
    if (input.document) {
      if (input.document.content.length > 10 * 1024 * 1024 ||
          !input.document.content.subarray(0, 5).equals(Buffer.from("%PDF-")))
        throw new Error("Choose a ticket PDF up to 10 MB.");
      const media = new FormData();
      media.set("messaging_product", "whatsapp");
      media.set("type", "application/pdf");
      media.set("file", new Blob([new Uint8Array(input.document.content)], { type: "application/pdf" }), input.document.filename);
      const uploaded = await fetch(
        `https://graph.facebook.com/${env.data.WHATSAPP_API_VERSION}/${env.data.WHATSAPP_PHONE_NUMBER_ID}/media`,
        { method: "POST", headers: { Authorization: `Bearer ${env.data.WHATSAPP_CLOUD_TOKEN}` }, body: media, signal: AbortSignal.timeout(20000) },
      );
      if (!uploaded.ok) throw new Error(`WhatsApp ticket upload failed (HTTP ${uploaded.status}).`);
      const { id } = z.object({ id: z.string().min(1) }).parse(await uploaded.json());
      components.push({ type: "header", parameters: [{ type: "document", document: { id, filename: input.document.filename } }] });
    }
    if (input.params.length) components.push({ type: "body", parameters: input.params.map(text => ({ type: "text", text })) });
    const response = await fetch(
      `https://graph.facebook.com/${env.data.WHATSAPP_API_VERSION}/${env.data.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.data.WHATSAPP_CLOUD_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone.number.slice(1),
          type: "template",
          biz_opaque_callback_data: input.notificationId,
          template: {
            name: input.templateName,
            language: { code: input.language },
            components,
          },
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        `WhatsApp rejected the template (HTTP ${response.status}, code ${typeof result.error?.code === "number" ? result.error.code : "unknown"}).`,
      );
    return {
      providerMessageId: z
        .object({
          messages: z.array(z.object({ id: z.string().min(1) })).min(1),
        })
        .parse(result).messages[0].id,
    };
  },
};
