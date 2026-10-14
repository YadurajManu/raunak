import { createTransport } from "nodemailer";
import { Resend } from "resend";

export interface EmailProvider {
  send(input: { to: string; subject: string; text: string }): Promise<void>;
}

const provider: EmailProvider = {
  async send({ to, subject, text }) {
    const from = process.env.EMAIL_FROM;
    if (!from) throw new Error("EMAIL_FROM is required.");
    if (process.env.EMAIL_PROVIDER === "smtp") {
      await createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 1025, secure: false }).sendMail({ from, to, subject, text });
    } else if (process.env.EMAIL_PROVIDER === "resend") {
      const key = process.env.RESEND_API_KEY;
      if (!key) throw new Error("RESEND_API_KEY is required.");
      const result = await new Resend(key).emails.send({ from, to, subject, text });
      if (result.error) throw new Error(result.error.message);
    } else throw new Error("Unsupported email provider.");
  },
};

export const sendEmail = provider.send;
