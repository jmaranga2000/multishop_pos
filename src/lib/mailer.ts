import nodemailer from "nodemailer";

export const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
});

export async function sendQueuedEmail(message: { recipient: string; subject: string; htmlBody: string; textBody: string | null }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM_EMAIL) throw new Error("SMTP is not configured");
  await mailTransporter.sendMail({
    from: { name: process.env.SMTP_FROM_NAME ?? "MultiShop POS", address: process.env.SMTP_FROM_EMAIL },
    to: message.recipient,
    subject: message.subject,
    html: message.htmlBody,
    text: message.textBody ?? undefined,
  });
}
