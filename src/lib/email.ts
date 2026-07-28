import "server-only";

/**
 * Email seam. The whole app sends mail through `sendEmail` only, so swapping
 * providers is a one-file change.
 *
 * - RESEND_API_KEY set → sends via Resend's HTTP API (no dependency, just fetch).
 * - otherwise         → logs the message to the server console (dev/demo mode),
 *                       so flows work end-to-end without a provider configured.
 *
 * EMAIL_FROM sets the sender (e.g. "OQU <noreply@yourdomain.kz>").
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export function isEmailLive(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  return process.env.EMAIL_FROM || "OQU <onboarding@resend.dev>";
}

export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Demo mode: no provider configured. Log so flows are testable in dev and
    // so a misconfigured production deploy is obvious in the logs.
    console.info(
      `[email:demo] To: ${msg.to}\nSubject: ${msg.subject}\n${msg.text ?? msg.html}`,
    );
    return { ok: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) {
      console.error(`[email] Resend ${res.status}: ${await res.text()}`);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] send failed:", err);
    return { ok: false };
  }
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
