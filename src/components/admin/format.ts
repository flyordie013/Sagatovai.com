/**
 * Date formatting for the admin panel.
 *
 * The server runs on UTC, the owner lives in Almaty (UTC+5) — without an
 * explicit `timeZone` every timestamp shows up five hours early, which turns
 * "заявка пришла вечером" into "заявка пришла днём". All admin screens must use
 * these two formatters so they agree with each other.
 */
const TIME_ZONE = "Asia/Almaty";

const dateOnly = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const dateTime = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

/** «29 июл. 2026» in Almaty time. */
export function formatDate(value: Date | string): string {
  return dateOnly.format(new Date(value));
}

/** «29 июл., 18:40» in Almaty time. */
export function formatDateTime(value: Date | string): string {
  return dateTime.format(new Date(value));
}
