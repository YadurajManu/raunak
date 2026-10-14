import { createTransport } from "nodemailer";
import { Resend } from "resend";

export interface EmailProvider {
  send(input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    idempotencyKey?: string;
    attachments?: { filename: string; content: Buffer }[];
  }): Promise<void>;
}

const provider: EmailProvider = {
  async send({ to, subject, text, html, attachments, idempotencyKey }) {
    const from = process.env.EMAIL_FROM;
    if (!from) throw new Error("EMAIL_FROM is required.");
    if (process.env.EMAIL_PROVIDER === "smtp") {
      const port = Number(process.env.SMTP_PORT) || 1025;
      await createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        ...(process.env.SMTP_USER
          ? {
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
              },
            }
          : {}),
        connectionTimeout: 15000,
        socketTimeout: 30000,
      }).sendMail({
        from,
        to,
        subject,
        text,
        html,
        attachments,
        ...(idempotencyKey
          ? { messageId: `<${idempotencyKey}@raunak.yaduraj.me>` }
          : {}),
      });
    } else if (process.env.EMAIL_PROVIDER === "resend") {
      const key = process.env.RESEND_API_KEY;
      if (!key) throw new Error("RESEND_API_KEY is required.");
      const result = await new Resend(key).emails.send(
        { from, to, subject, text, html, attachments },
        idempotencyKey ? { idempotencyKey } : undefined,
      );
      if (result.error)
        throw new Error(
          "Email provider rejected the message. Check sender verification and credentials.",
        );
    } else throw new Error("Unsupported email provider.");
  },
};

export const sendEmail = provider.send;
