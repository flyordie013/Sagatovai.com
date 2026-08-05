/**
 * Single source of truth for the contacts the platform shows and writes to.
 *
 * The WhatsApp number used to be copy-pasted into every screen that offers to
 * "написать нам" (курс, кабинет, политика, подвал), so changing it meant
 * hunting for string literals. Everything reads from here now, and the server
 * can override the values via env without a code change:
 *
 *   SUPPORT_WHATSAPP  — number in any shape, non-digits are stripped
 *   SUPPORT_EMAIL     — public support mailbox
 *   OWNER_EMAIL       — where new-lead notifications are sent
 */

/** Digits only, international format without «+» — the shape wa.me expects. */
const DEFAULT_WHATSAPP = "77073330241";
const DEFAULT_SUPPORT_EMAIL = "info@sagatovai.com";

/** «77073330241» → «+7 707 333 0241»; anything else falls back to «+<digits>». */
function formatKzPhone(digits: string): string {
  const m = /^(\d)(\d{3})(\d{3})(\d{4})$/.exec(digits);
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]}` : `+${digits}`;
}

/** Normalized number, e.g. «77073330241». */
export const SUPPORT_WHATSAPP =
  (process.env.SUPPORT_WHATSAPP ?? "").replace(/\D/g, "") || DEFAULT_WHATSAPP;

/** Ready-to-use href for a WhatsApp chat. */
export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP}`;

/** Human-readable number for UI, e.g. «+7 707 333 0241». */
export const SUPPORT_PHONE_DISPLAY = formatKzPhone(SUPPORT_WHATSAPP);

/** Public support mailbox. */
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL;

/**
 * Recipient for "новая заявка" notifications. Falls back to the bootstrap owner
 * created on first boot (already configured on every deploy), then to the
 * public support mailbox — so a lead alert always has somewhere to go.
 */
export const OWNER_NOTIFY_EMAIL =
  process.env.OWNER_EMAIL || process.env.BOOTSTRAP_OWNER_EMAIL || SUPPORT_EMAIL;
