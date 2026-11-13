/** One byte range; null means the header is invalid or unsatisfiable. */
export function byteRange(header: string, size: number, openLimit = Infinity): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2]) || size <= 0) return null;
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last))) return null;
  if (first === null) {
    if (!last) return null;
    return { start: Math.max(0, size - last), end: size - 1 };
  }
  const end = Math.min(last ?? first + openLimit - 1, size - 1);
  return first >= size || first > end ? null : { start: first, end };
}
