import { z } from "zod";

const serverSchema = z
  .object({
    APP_URL: z.url(),
    GEOAPIFY_API_KEY: z.string().optional(),
    NEXT_PUBLIC_MAP_TILE_URL: z.string().optional(),
    NEXT_PUBLIC_MAP_ATTRIBUTION: z.string().optional(),
    DATABASE_URL: z.string().startsWith("postgresql://"),
    REDIS_URL: z.string().startsWith("redis://"),
    FIREBASE_PROJECT_ID: z.string().min(1),
    FIREBASE_CLIENT_EMAIL: z.email(),
    FIREBASE_PRIVATE_KEY: z.string().min(1),
    RAUNAK_ADMIN_FIREBASE_UIDS: z.string().optional(),
    CASHFREE_ENV: z.enum(["sandbox", "production"]),
    CASHFREE_APP_ID: z.string().min(1),
    CASHFREE_SECRET_KEY: z.string().min(1),
    CASHFREE_API_VERSION: z.string().min(1),
    S3_ENDPOINT: z.url(),
    S3_REGION: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_PUBLIC_BASE_URL: z.url(),
    EMAIL_PROVIDER: z.enum(["resend", "ses", "smtp"]),
    RESEND_API_KEY: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    EMAIL_FROM: z.string().min(1),
    WHATSAPP_PROVIDER: z.enum(["meta-cloud", "baileys", "mock"]),
    WA_UNOFFICIAL_ENABLED: z.enum(["true", "false"]).default("false"),
    WA_GATEWAY_URL: z.url().optional(),
    WA_GATEWAY_API_KEY: z.string().min(32).optional(),
    WA_MAX_DAILY: z.coerce.number().int().positive().default(400),
    WA_PER_RECIPIENT_DAILY: z.coerce.number().int().positive().default(6),
    WA_MIN_DELAY_MS: z.coerce.number().int().nonnegative().default(4000),
    WA_MAX_DELAY_MS: z.coerce.number().int().nonnegative().default(12000),
    WHATSAPP_CLOUD_TOKEN: z.string().optional(),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
    WHATSAPP_WABA_ID: z.string().optional(),
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
    WHATSAPP_APP_SECRET: z.string().optional(),
    TICKET_SIGNING_SECRET: z.string().min(32),
    ENCRYPTION_KEY: z.string().min(32),
  })
  .superRefine((value, context) => {
    if (value.WA_MAX_DELAY_MS < value.WA_MIN_DELAY_MS)
      context.addIssue({
        code: "custom",
        path: ["WA_MAX_DELAY_MS"],
        message: "Must be at least WA_MIN_DELAY_MS",
      });
    if (value.WHATSAPP_PROVIDER === "meta-cloud")
      for (const field of [
        "WHATSAPP_CLOUD_TOKEN",
        "WHATSAPP_PHONE_NUMBER_ID",
        "WHATSAPP_WABA_ID",
        "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
        "WHATSAPP_APP_SECRET",
      ] as const) {
        if (!value[field])
          context.addIssue({
            code: "custom",
            path: [field],
            message: "Required for the official Meta provider",
          });
      }
    if (value.WA_UNOFFICIAL_ENABLED === "true")
      for (const field of ["WA_GATEWAY_URL", "WA_GATEWAY_API_KEY"] as const) {
        if (!value[field])
          context.addIssue({
            code: "custom",
            path: [field],
            message: "Required when unofficial delivery is enabled",
          });
      }
  });

const publicSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
});

export function getServerEnv() {
  const result = serverSchema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      `Invalid server environment: ${z.prettifyError(result.error)}`,
    );
  return result.data;
}

export function getPublicEnv() {
  const result = publicSchema.safeParse({
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  if (!result.success)
    throw new Error(
      `Invalid public environment: ${z.prettifyError(result.error)}`,
    );
  return result.data;
}
