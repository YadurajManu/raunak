import { z } from "zod";

const serverSchema = z.object({
  APP_URL: z.url(),
  DATABASE_URL: z.string().startsWith("postgresql://"),
  REDIS_URL: z.string().startsWith("redis://"),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
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
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.email(),
  WHATSAPP_PROVIDER: z.enum(["meta-cloud", "wwebjs"]),
  WHATSAPP_CLOUD_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_WABA_ID: z.string().min(1),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  TICKET_SIGNING_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),
});

const publicSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
});

export function getServerEnv() {
  const result = serverSchema.safeParse(process.env);
  if (!result.success) throw new Error(`Invalid server environment: ${z.prettifyError(result.error)}`);
  return result.data;
}

export function getPublicEnv() {
  const result = publicSchema.safeParse(process.env);
  if (!result.success) throw new Error(`Invalid public environment: ${z.prettifyError(result.error)}`);
  return result.data;
}
