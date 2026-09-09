/**
 * Single source of truth for email contacts.
 *
 *   SUPPORT_EMAIL — public support mailbox
 *   OWNER_EMAIL   — where new-lead and purchase-request notifications are sent
 */

const DEFAULT_SUPPORT_EMAIL = "info@sagatovai.com";

/** Public support mailbox. */
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL;

/**
 * Recipient for "новая заявка" notifications. Falls back to the bootstrap owner
 * created on first boot (already configured on every deploy), then to the
 * public support mailbox — so a lead alert always has somewhere to go.
 */
export const OWNER_NOTIFY_EMAIL =
  process.env.OWNER_EMAIL || process.env.BOOTSTRAP_OWNER_EMAIL || SUPPORT_EMAIL;
