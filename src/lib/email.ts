import "server-only";
import { createTransport } from "nodemailer";

/**
 * Email seam. The whole app sends mail through `sendEmail` only, so swapping
 * providers is a one-file change.
 *
 * SMTP works with any provider: PS.KZ mail, Gmail Workspace, Mailgun, etc.
 * Without SMTP configuration messages are logged instead of silently lost;
 * the admin dashboard also shows a configuration warning.
 *
 * Required: SMTP_HOST, SMTP_USER, SMTP_PASSWORD and EMAIL_FROM.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function value(name: string): string {
  return (process.env[name] ?? "").trim();
}

function smtpPort(): number {
  const parsed = Number.parseInt(value("SMTP_PORT"), 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : 587;
}

function smtpSecure(port: number): boolean {
  const configured = value("SMTP_SECURE").toLowerCase();
  if (configured === "true" || configured === "1") return true;
  if (configured === "false" || configured === "0") return false;
  return port === 465;
}

/** Human-readable reason shown in the owner dashboard when SMTP is incomplete. */
export function emailConfigIssue(): string | null {
  if (!value("SMTP_HOST")) return "не задан SMTP_HOST";
  if (!value("SMTP_USER")) return "не задан SMTP_USER";
  if (!value("SMTP_PASSWORD")) return "не задан SMTP_PASSWORD";
  if (!value("EMAIL_FROM")) return "не задан EMAIL_FROM";
  return null;
}

export function isEmailLive(): boolean {
  return emailConfigIssue() === null;
}

type MailTransport = ReturnType<typeof createTransport>;
let transport: MailTransport | null = null;

function smtpTransport(): MailTransport {
  if (transport) return transport;

  const port = smtpPort();
  transport = createTransport({
    host: value("SMTP_HOST"),
    port,
    secure: smtpSecure(port),
    auth: { user: value("SMTP_USER"), pass: value("SMTP_PASSWORD") },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transport;
}

export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean }> {
  const configIssue = emailConfigIssue();

  if (configIssue) {
    console.info(
      `[email:disabled] ${configIssue}. To: ${msg.to}\nSubject: ${msg.subject}\n${msg.text ?? msg.html}`,
    );
    return { ok: false };
  }

  try {
    await smtpTransport().sendMail({
      from: value("EMAIL_FROM"),
      to: msg.to,
      replyTo: value("EMAIL_REPLY_TO") || undefined,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] SMTP send failed:", err);
    return { ok: false };
  }
}

/**
 * Escapes text that a user typed before it goes into the HTML part of an email.
 * Lives next to `emailLayout` on purpose: every caller that builds mail markup
 * already imports from this module, so the next email added to the project
 * reaches for the same helper instead of growing a fourth private copy.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Minimal branded wrapper so transactional mail looks intentional. */
export function emailLayout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0f1014;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#f4f2ec">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#17181e;border:1px solid #262832;border-radius:16px;overflow:hidden">
      <tr><td style="padding:28px 32px 8px"><span style="font-weight:800;letter-spacing:.08em;font-size:20px;color:#f5a524">OQU</span></td></tr>
      <tr><td style="padding:0 32px 8px"><h1 style="margin:0;font-size:20px">${title}</h1></td></tr>
      <tr><td style="padding:8px 32px 28px;color:#b8b8c0;font-size:14px;line-height:1.6">${bodyHtml}</td></tr>
    </table>
    <p style="margin:16px 0 0;color:#6b6b76;font-size:12px">© ${new Date().getFullYear()} OQU</p>
  </td></tr></table></body></html>`;
}
