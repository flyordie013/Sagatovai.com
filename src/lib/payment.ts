/**
 * Manual checkout ("быстрый путь") configuration.
 *
 * The platform has no payment gateway: the student leaves a request, transfers
 * the money themselves and sends the receipt over WhatsApp. Everything shown on
 * that screen — the number, the recipient name, the extra instruction — is the
 * owner's real banking data, which we must never guess, so it lives in env only
 * and has NO fallback:
 *
 *   KASPI_NUMBER     — phone or card number the transfer goes to
 *   KASPI_LINK       — optional kaspi.kz link that opens the app straight away
 *   KASPI_RECIPIENT  — name as the student sees it while confirming the transfer
 *   PAYMENT_NOTE     — optional one-line instruction from the owner
 *
 * With none of them set `isPaymentConfigured` is false and the purchase flow
 * keeps its old "менеджер свяжется с вами" ending: a missing screen is better
 * than a screen with invented bank details.
 */

import { SUPPORT_WHATSAPP_URL } from "./contacts";
import { formatNumber } from "./utils";

export interface PaymentDetails {
  /** Grouped for reading on a phone, e.g. «+7 XXX XXX XXXX». Empty when unset. */
  numberDisplay: string;
  /** The same number in one piece — what the copy button puts on the clipboard. */
  numberCopy: string;
  /** Link that opens Kaspi directly. Empty when unset or not an http(s) URL. */
  link: string;
  /** Recipient name as it appears in the transfer confirmation. */
  recipient: string;
  /** Short extra instruction from the owner. */
  note: string;
}

const rawNumber = (process.env.KASPI_NUMBER ?? "").trim();
const digits = rawNumber.replace(/\D/g, "");
/**
 * Only a plain number may be re-grouped. An IBAN (KZ86…) or any other shape the
 * owner entered is shown exactly as typed — reformatting a number we don't
 * recognize is how people end up paying the wrong account.
 */
const plainNumber = rawNumber !== "" && /^[+\d\s()-]+$/.test(rawNumber);
const isKzPhone = plainNumber && /^7\d{10}$/.test(digits);
const isCard = plainNumber && digits.length === 16;

/** A KZ phone is spaced into «+7 XXX XXX XXXX», a card into groups of four. */
function displayNumber(): string {
  if (isKzPhone) {
    return `+${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (isCard) return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  return rawNumber;
}

/**
 * Anything that isn't an http(s) URL is dropped — an env typo must never become
 * an href. A pasted link without a scheme (`kaspi.kz/pay/…`, the way anyone
 * would copy it) gets https:// rather than being silently discarded.
 */
function httpUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const candidate = value.includes("://") ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    /* fall through to the warning below */
  }
  console.warn("[payment] KASPI_LINK is not a usable http(s) URL — ignoring it.");
  return "";
}

export const PAYMENT: PaymentDetails = {
  numberDisplay: displayNumber(),
  // Never hand the clipboard a value with spaces in it: the recipient field in
  // a banking app rejects (or silently truncates) what it's pasted into.
  numberCopy: isKzPhone ? `+${digits}` : isCard ? digits : rawNumber.replace(/\s+/g, ""),
  link: httpUrl(process.env.KASPI_LINK ?? ""),
  recipient: (process.env.KASPI_RECIPIENT ?? "").trim(),
  note: (process.env.PAYMENT_NOTE ?? "").trim(),
};

/**
 * True once the owner has said WHERE the money goes. Every screen that would
 * show payment details is gated on this — the recipient name and the note are
 * optional extras, they can't make a screen payable on their own.
 */
export const isPaymentConfigured: boolean = Boolean(PAYMENT.numberDisplay || PAYMENT.link);

/**
 * wa.me link with the receipt message pre-filled. The student still attaches the
 * screenshot by hand; this only saves them typing what they paid for, and saves
 * the owner from asking.
 */
export function receiptWhatsAppUrl({
  courseTitle,
  studentName,
  studentEmail,
  amount,
}: {
  courseTitle: string;
  /** Full name — a first name alone can't be matched to a row in /admin/requests. */
  studentName: string;
  /** The account the access has to be opened on. */
  studentEmail?: string;
  amount: number;
}): string {
  const text = [
    `Здравствуйте! Оплатил(а) курс «${courseTitle}».`,
    `Имя: ${studentName}`,
    ...(studentEmail ? [`Аккаунт: ${studentEmail}`] : []),
    `Сумма: ${formatNumber(amount)} ₸`,
    "Прикладываю чек.",
  ].join("\n");
  return `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(text)}`;
}
