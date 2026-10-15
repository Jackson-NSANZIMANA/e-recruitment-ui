// ═══════════════════════════════════════════════════════════════
// applicant-portal — exam QR rendering (ADR-033)
//
// The payload is the signed slot invitation (USRP-SLOT.v1…). It is encoded
// EXACTLY as received: the venue verifies the signature over these bytes, so
// any transformation (trimming, case, URL-wrapping) would make a genuine
// ticket fail at the gate.
//
// Error correction 'M' (≈15 % recovery) is the balance between density and
// robustness for a ~700-character token printed on paper or shown on a phone.
// The quiet zone is the standard 4 modules — scanners need it.
// ═══════════════════════════════════════════════════════════════

import qrcode from "qrcode-generator";

// The QR's colours are NOT theme colours: a scanner needs maximum contrast, so
// the code is black on white in every theme (dark mode / high contrast would
// otherwise invert it and some gate scanners refuse inverted codes).
// eslint-disable-next-line usrp/no-raw-hex -- hygiene-allow-hex: QR scan contrast, theme-independent
export const QR_LIGHT = "#ffffff";
// eslint-disable-next-line usrp/no-raw-hex -- hygiene-allow-hex: QR scan contrast, theme-independent
export const QR_DARK = "#000000";

export const QUIET_ZONE = 4;
const TOKEN_RE = /^USRP-SLOT\.v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** Dark/light modules (row-major), or null for a payload that is not a ticket. */
export function qrMatrix(payload: string): readonly (readonly boolean[])[] | null {
  if (!TOKEN_RE.test(payload) || payload.length > 4096) return null;
  const qr = qrcode(0, "M");
  qr.addData(payload, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const rows: boolean[][] = [];
  for (let r = 0; r < n; r += 1) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c += 1) row.push(qr.isDark(r, c));
    rows.push(row);
  }
  return rows;
}

/** One SVG path for every dark module — crisp at any size, no innerHTML. */
export function qrSvgPath(matrix: readonly (readonly boolean[])[]): string {
  let d = "";
  matrix.forEach((row, r) => {
    row.forEach((dark, c) => {
      if (dark) d += `M${String(c + QUIET_ZONE)} ${String(r + QUIET_ZONE)}h1v1h-1z`;
    });
  });
  return d;
}

export interface TicketLines {
  readonly title: string;
  readonly lines: readonly string[];
}

/**
 * A printable PNG: the QR (with quiet zone) above the human-readable details,
 * so the downloaded file is useful on its own at the gate and offline.
 */
export async function renderTicketPng(
  matrix: readonly (readonly boolean[])[],
  text: TicketLines,
  scale = 8,
): Promise<Blob> {
  const modules = matrix.length + QUIET_ZONE * 2;
  const qrPx = modules * scale;
  const padding = 24;
  const lineHeight = 26;
  const width = Math.max(qrPx + padding * 2, 520);
  const height = padding + 34 + qrPx + padding + text.lines.length * lineHeight + padding;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("Canvas is not available in this browser.");
  ctx.fillStyle = QR_LIGHT;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = QR_DARK;
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text.title, width / 2, padding + 20);
  const left = Math.floor((width - qrPx) / 2);
  const top = padding + 34;
  matrix.forEach((row, r) => {
    row.forEach((dark, c) => {
      if (dark) ctx.fillRect(left + (c + QUIET_ZONE) * scale, top + (r + QUIET_ZONE) * scale, scale, scale);
    });
  });
  ctx.font = "16px sans-serif";
  text.lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, top + qrPx + padding + (i + 1) * lineHeight - 8);
  });
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new Error("The QR image could not be created."));
      else resolve(blob);
    }, "image/png");
  });
}

/** Trigger a browser download of a blob, and release the object URL. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** A filesystem-safe file name from the public processing code. */
export function ticketFilename(processingCode: string): string {
  return `usrp-exam-qr-${processingCode.replace(/[^A-Za-z0-9-]/g, "_")}.png`;
}
