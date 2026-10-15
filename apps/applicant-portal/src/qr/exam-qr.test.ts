import { describe, expect, it } from "vitest";
import { QUIET_ZONE, qrMatrix, qrSvgPath, ticketFilename } from "./exam-qr.js";

const TOKEN = `USRP-SLOT.v1.${"eyJ0aWNrZXRJZCI6IlRLVC0xIn0".repeat(20)}.${"c2lnbmF0dXJl".repeat(8)}`;

/** A QR finder pattern: 7×7 dark ring, light ring, 3×3 dark core. */
function finderAt(m: readonly (readonly boolean[])[], top: number, left: number): boolean {
  for (let r = 0; r < 7; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      const ring = r === 0 || r === 6 || c === 0 || c === 6;
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      if (m[top + r]?.[left + c] !== (ring || core)) return false;
    }
  }
  return true;
}

describe("exam QR", () => {
  it("encodes a ticket into a square symbol with the three finder patterns", () => {
    const m = qrMatrix(TOKEN);
    expect(m).not.toBeNull();
    if (m === null) return;
    const n = m.length;
    expect(m.every((row) => row.length === n)).toBe(true);
    expect(finderAt(m, 0, 0)).toBe(true);
    expect(finderAt(m, 0, n - 7)).toBe(true);
    expect(finderAt(m, n - 7, 0)).toBe(true);
  });

  it("is deterministic for the same payload", () => {
    expect(JSON.stringify(qrMatrix(TOKEN))).toBe(JSON.stringify(qrMatrix(TOKEN)));
  });

  it("refuses anything that is not a USRP-SLOT.v1 ticket", () => {
    expect(qrMatrix("https://evil.example/x")).toBeNull();
    expect(qrMatrix("USRP-SLOT.v1.a b.c")).toBeNull();
    expect(qrMatrix("")).toBeNull();
  });

  it("draws every dark module inside the quiet zone", () => {
    const m = qrMatrix(TOKEN);
    if (m === null) throw new Error("setup");
    const path = qrSvgPath(m);
    const darks = m.flat().filter(Boolean).length;
    expect(path.split("M").length - 1).toBe(darks);
    expect(path.startsWith(`M${String(QUIET_ZONE)} ${String(QUIET_ZONE)}`)).toBe(true);
  });

  it("names the file from the public processing code only", () => {
    expect(ticketFilename("RDF-00042")).toBe("usrp-exam-qr-RDF-00042.png");
    expect(ticketFilename("../../etc")).toBe("usrp-exam-qr-______etc.png");
  });
});

import jsQR from "jsqr";

describe("exam QR round trip", () => {
  it("a scanner decodes EXACTLY the signed token back (what the venue reads)", () => {
    const m = qrMatrix(TOKEN);
    if (m === null) throw new Error("setup");
    const scale = 4;
    const size = (m.length + QUIET_ZONE * 2) * scale;
    const rgba = new Uint8ClampedArray(size * size * 4).fill(255);
    m.forEach((row, r) => {
      row.forEach((dark, c) => {
        if (!dark) return;
        for (let y = 0; y < scale; y += 1) {
          for (let x = 0; x < scale; x += 1) {
            const px = ((r + QUIET_ZONE) * scale + y) * size + (c + QUIET_ZONE) * scale + x;
            rgba[px * 4] = 0; rgba[px * 4 + 1] = 0; rgba[px * 4 + 2] = 0;
          }
        }
      });
    });
    const decoded = jsQR(rgba, size, size);
    expect(decoded?.data).toBe(TOKEN);
  });
});
