import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export const checkoutSelectionSchema = z
  .object({
    eventId: z.uuid(),
    items: z
      .array(
        z.object({
          ticketTypeId: z.uuid(),
          quantity: z.number().int().positive().max(10),
        }),
      )
      .min(1)
      .max(20),
  })
  .superRefine((data, context) => {
    if (
      new Set(data.items.map((item) => item.ticketTypeId)).size !==
      data.items.length
    )
      context.addIssue({
        code: "custom",
        message: "Choose each ticket type only once.",
        path: ["items"],
      });
  });

export function orderedAttendeeNames(data: {
  items: { ticketTypeId: string; quantity: number }[];
  attendeeNames?: string[];
}) {
  if (!data.attendeeNames) return undefined;
  let offset = 0;
  return data.items
    .map((item) => {
      const names = data.attendeeNames!.slice(offset, offset + item.quantity);
      offset += item.quantity;
      return { id: item.ticketTypeId, names };
    })
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap((item) => item.names);
}

export const checkoutInputSchema = checkoutSelectionSchema
  .safeExtend({
    buyerName: z.string().trim().min(2, "Enter your full name.").max(100),
    buyerPhone: z
      .string()
      .trim()
      .max(30)
      .optional()
      .transform((value, context) => {
        if (!value) return null;
        const phone = parsePhoneNumberFromString(value, "IN");
        if (!phone?.isValid()) {
          context.addIssue({
            code: "custom",
            message: "Enter a valid mobile number, including its country code.",
          });
          return z.NEVER;
        }
        return phone.number;
      }),
    whatsappOptIn: z.boolean().default(false),
    attendeeNames: z
      .array(z.string().trim().min(2, "Enter each attendee's name.").max(100))
      .max(100)
      .optional(),
    idempotencyKey: z.uuid(),
  })
  .superRefine((data, context) => {
    if (data.whatsappOptIn && !data.buyerPhone)
      context.addIssue({
        code: "custom",
        message: "Add a mobile number for WhatsApp delivery.",
        path: ["buyerPhone"],
      });
    if (
      data.attendeeNames &&
      data.attendeeNames.length !==
        data.items.reduce((sum, item) => sum + item.quantity, 0)
    )
      context.addIssue({
        code: "custom",
        message:
          "Add one attendee name for each ticket, or leave attendee names off.",
        path: ["attendeeNames"],
      });
  });
