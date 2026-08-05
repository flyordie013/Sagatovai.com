/**
 * Seller identity and refund terms — the facts an online store in Kazakhstan
 * has to publish next to a 100 000–200 000 ₸ price tag.
 *
 * Nothing here has a default value. A made-up БИН, address or refund window is
 * worse than a missing page: it is a public promise the owner never made. So
 * every field comes from the environment, and while the required ones are
 * blank `isLegalConfigured` stays false — /offer and /refund answer 404, and
 * their footer links and sitemap entries never appear.
 *
 *   LEGAL_ENTITY_NAME    — registered name, e.g. «Иванов И.» (required)
 *   LEGAL_ID             — БИН or ИИН (required)
 *   LEGAL_ADDRESS        — registered address (required)
 *   LEGAL_ENTITY_TYPE    — «ИП» / «ТОО» / «АО»; also picks the ИИН/БИН label
 *   LEGAL_ID_LABEL       — override for that label
 *   LEGAL_PHONE          — phone for the seller card, as it should be printed
 *   LEGAL_EMAIL          — mailbox for claims (pages fall back to SUPPORT_EMAIL)
 *   LEGAL_BANK_NAME      — bank name, БИК, IBAN — printed only when all three
 *   LEGAL_BANK_BIC         are present, an incomplete account number is
 *   LEGAL_BANK_IBAN        useless to a payer
 *   LEGAL_UPDATED        — «редакция от …» line on /offer and /refund
 *   LEGAL_ACCESS_MONTHS  — access term, when it is the same for every course
 *   LEGAL_REFUND_DAYS    — refund window in days (required for /refund)
 *   LEGAL_REFUND_PROGRESS_PERCENT — how much of the course may already be
 *                          completed, in percent
 *   LEGAL_REFUND_PAYOUT_DAYS — how long the money takes to come back
 */

/** Trimmed env value, or undefined when unset or blank. */
function str(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/** Whole number within [min, max], or undefined when unset or nonsensical. */
function int(name: string, min: number, max: number): number | undefined {
  const raw = str(name);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  const whole = Math.trunc(n);
  return whole >= min && whole <= max ? whole : undefined;
}

/**
 * In Kazakhstan a sole proprietor is identified by an ИИН and a company by a
 * БИН. When the form is unknown we print both — never a guess.
 */
function idLabelFor(entityType: string | undefined): string {
  if (!entityType) return "БИН/ИИН";
  const t = entityType.toUpperCase();
  if (t.startsWith("ИП")) return "ИИН";
  if (t.startsWith("ТОО") || t.startsWith("АО")) return "БИН";
  return "БИН/ИИН";
}

export type BankDetails = {
  name: string;
  bic: string;
  iban: string;
};

export type Seller = {
  /** Organizational form + name, e.g. «ИП Иванов И.» — the heading of the card. */
  displayName: string;
  /** «ИИН», «БИН» or «БИН/ИИН» — what {@link id} should be labelled with. */
  idLabel: string;
  id: string;
  address: string;
  phone?: string;
  email?: string;
  bank?: BankDetails;
};

export type RefundTerms = {
  /** Days after payment during which a refund can be requested. */
  days: number;
  /** Share of the course that may already be completed, in percent. */
  maxProgressPercent?: number;
  /** Days it takes to send the money back once the request is approved. */
  payoutDays?: number;
};

function buildSeller(): Seller | null {
  const name = str("LEGAL_ENTITY_NAME");
  const id = str("LEGAL_ID");
  const address = str("LEGAL_ADDRESS");
  if (!name || !id || !address) return null;

  const entityType = str("LEGAL_ENTITY_TYPE");
  const bankName = str("LEGAL_BANK_NAME");
  const bankBic = str("LEGAL_BANK_BIC");
  const bankIban = str("LEGAL_BANK_IBAN");

  return {
    displayName: entityType ? `${entityType} ${name}` : name,
    idLabel: str("LEGAL_ID_LABEL") ?? idLabelFor(entityType),
    id,
    address,
    phone: str("LEGAL_PHONE"),
    email: str("LEGAL_EMAIL"),
    bank:
      bankName && bankBic && bankIban
        ? { name: bankName, bic: bankBic, iban: bankIban }
        : undefined,
  };
}

function buildRefund(): RefundTerms | null {
  const days = int("LEGAL_REFUND_DAYS", 1, 365);
  if (days === undefined) return null;
  return {
    days,
    maxProgressPercent: int("LEGAL_REFUND_PROGRESS_PERCENT", 0, 100),
    payoutDays: int("LEGAL_REFUND_PAYOUT_DAYS", 1, 90),
  };
}

/** Seller details, or null while the required env is blank. */
export const SELLER: Seller | null = buildSeller();

/** Refund window, or null while the owner has not set one. */
export const REFUND: RefundTerms | null = buildRefund();

/** Access term in months, when every course shares the same one. */
export const ACCESS_MONTHS: number | undefined = int("LEGAL_ACCESS_MONTHS", 1, 120);

/** «Редакция от …» — free-form, e.g. «5 августа 2026 г.». */
export const LEGAL_UPDATED: string | undefined = str("LEGAL_UPDATED");

/**
 * The single switch every legal page and link checks: true only when the
 * seller can actually be identified on the page. Nothing legal is published
 * while it is false.
 */
export const isLegalConfigured: boolean = SELLER !== null;

/** /refund additionally needs a refund window — a term nobody may invent. */
export const isRefundConfigured: boolean = isLegalConfigured && REFUND !== null;
