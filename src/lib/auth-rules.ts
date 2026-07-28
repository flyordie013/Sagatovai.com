/**
 * Shared auth rules. Kept out of any `"use server"` module — those may only
 * export async functions, so constants live here and are imported by both the
 * server actions and the client forms that mirror the validation.
 */
export const MIN_PASSWORD = 8;
