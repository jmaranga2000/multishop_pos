import nodemailer from "nodemailer";

export const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
});

export async function sendQueuedEmail(message: {
  recipient: string;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  attachments?: Array<{ filename: string; contentType: string; content: string }>;
}) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM_EMAIL) throw new Error("SMTP is not configured");
  if (!message.recipient?.trim()) throw new Error("Email recipient is missing");
  if (!message.subject?.trim()) throw new Error("Email subject is missing");

  await mailTransporter.sendMail({
    from: { name: process.env.SMTP_FROM_NAME ?? "MultiShop POS", address: process.env.SMTP_FROM_EMAIL },
    to: message.recipient,
    subject: message.subject,
    html: message.htmlBody,
    text: message.textBody ?? undefined,
    attachments: message.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.content, "base64"),
      contentType: attachment.contentType,
    })),
  });
}
