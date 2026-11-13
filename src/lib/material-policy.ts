export const MATERIAL_TYPES: Record<string, string> = {
  pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", csv: "text/csv", json: "application/json", zip: "application/zip",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
};
export const MATERIAL_ACCEPT = Object.keys(MATERIAL_TYPES).map((ext) => `.${ext}`).join(",");
export const MAX_MATERIALS = 30;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function cleanFilename(raw: string): string {
  return raw.normalize("NFC").replace(/[\\/\u0000-\u001f\u007f<>:"|?*]/g, "_").replace(/^\.+/, "").trim().slice(-180);
}
export function materialExtension(name: string): string { return name.split(".").pop()?.toLowerCase() || ""; }
export function formatFileSize(bytes: number): string {
  return bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} МБ` : `${Math.max(1, Math.ceil(bytes / 1024))} КБ`;
}
/** Content sniffing in addition to the extension; all downloads are forced attachments. */
export function validMaterialSignature(ext: string, bytes: Uint8Array): boolean {
  const hex = (values: number[]) => values.every((v, i) => bytes[i] === v);
  if (ext === "pdf") return hex([37, 80, 68, 70, 45]);
  if (["zip", "docx", "xlsx", "pptx"].includes(ext)) return hex([80, 75, 3, 4]) || hex([80, 75, 5, 6]);
  if (ext === "png") return hex([137, 80, 78, 71, 13, 10, 26, 10]);
  if (["jpg", "jpeg"].includes(ext)) return hex([255, 216, 255]);
  if (ext === "webp") return hex([82, 73, 70, 70]) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (["txt", "csv", "json"].includes(ext)) return bytes.length > 0 && !bytes.includes(0);
  return false;
}
