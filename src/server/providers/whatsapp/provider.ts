import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
export interface WhatsAppProvider {
  sendTemplate(input: {
    to: string;
    templateName: string;
    language: string;
    params: string[];
    notificationId: string;
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
            components: input.params.length
              ? [
                  {
                    type: "body",
                    parameters: input.params.map((text) => ({
                      type: "text",
                      text,
                    })),
                  },
                ]
              : [],
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
